const express = require("express");
const router = express.Router();
const Appointment = require("../models/Appointment");
const Availability = require("../models/Availability");
const { authenticateToken, requireRole } = require("../middleware/auth");

// Book a new appointment (Student only)
router.post("/", authenticateToken, requireRole("student"), async (req, res) => {
  const studentId = req.user.id;
  const { professorId, slot, isCustom } = req.body;

  if (!professorId || !slot || !slot.start || !slot.end) {
    return res.status(400).json({ message: "Professor ID and slot (start and end) are required" });
  }

  try {
    // 1. Check if professor has this slot in their availability (only if not a custom request)
    if (!isCustom) {
      const availability = await Availability.findOne({ professorId });
      const isAvailable = availability?.slots.some(
        (s) => s.start === slot.start && s.end === slot.end
      );

      if (!isAvailable) {
        return res.status(400).json({ message: "Slot not available" });
      }
    }

    // 2. Check if slot is already confirmed
    const existing = await Appointment.findOne({
      professorId,
      "slot.start": slot.start,
      "slot.end": slot.end,
      status: "confirmed"
    });

    if (existing) {
      return res.status(409).json({ message: "Slot is already booked and confirmed" });
    }

    // 3. Create new appointment with status pending
    const appointment = new Appointment({
      studentId,
      professorId,
      slot,
      status: "pending"
    });

    await appointment.save();
    res.status(201).json({ message: "Appointment booked successfully", appointment });
  } catch (err) {
    res.status(500).json({ message: "Error booking appointment", error: err.message });
  }
});

// Confirm appointment (Professor only)
router.patch("/:id/confirm", authenticateToken, requireRole("professor"), async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appointment.professorId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to confirm this appointment" });
    }

    // Verify no other appointment is already confirmed for this slot
    const alreadyConfirmed = await Appointment.findOne({
      _id: { $ne: appointment._id },
      professorId: appointment.professorId,
      "slot.start": appointment.slot.start,
      "slot.end": appointment.slot.end,
      status: "confirmed"
    });

    if (alreadyConfirmed) {
      return res.status(409).json({ message: "Another appointment has already been confirmed for this slot" });
    }

    appointment.status = "confirmed";
    await appointment.save();

    // Automatically cancel all other pending requests for the exact same slot
    await Appointment.updateMany(
      {
        _id: { $ne: appointment._id },
        professorId: appointment.professorId,
        "slot.start": appointment.slot.start,
        "slot.end": appointment.slot.end,
        status: "pending"
      },
      {
        $set: { status: "cancelled" }
      }
    );

    res.status(200).json({ message: "Appointment confirmed", appointment });
  } catch (err) {
    res.status(500).json({ message: "Error confirming appointment", error: err.message });
  }
});

// Cancel appointment (Student or Professor)
router.patch("/:id/cancel", authenticateToken, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    const isStudent = appointment.studentId.toString() === req.user.id;
    const isProfessor = appointment.professorId.toString() === req.user.id;

    if (!isStudent && !isProfessor) {
      return res.status(403).json({ message: "Not authorized to cancel this appointment" });
    }

    appointment.status = "cancelled";
    await appointment.save();

    res.status(200).json({ message: "Appointment cancelled", appointment });
  } catch (err) {
    res.status(500).json({ message: "Error cancelling appointment", error: err.message });
  }
});

// Reschedule appointment (Student only)
router.patch("/:id/reschedule", authenticateToken, requireRole("student"), async (req, res) => {
  const { slot } = req.body;

  if (!slot || !slot.start || !slot.end) {
    return res.status(400).json({ message: "New slot (start and end) is required" });
  }

  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appointment.studentId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to reschedule this appointment" });
    }

    const { professorId } = appointment;

    // 1. Check if professor has this new slot in availability
    const availability = await Availability.findOne({ professorId });
    const isAvailable = availability?.slots.some(
      (s) => s.start === slot.start && s.end === slot.end
    );

    if (!isAvailable) {
      return res.status(400).json({ message: "Slot not available" });
    }

    // 2. Check if slot is already confirmed by another appointment
    const existing = await Appointment.findOne({
      _id: { $ne: appointment._id },
      professorId,
      "slot.start": slot.start,
      "slot.end": slot.end,
      status: "confirmed"
    });

    if (existing) {
      return res.status(409).json({ message: "Slot already booked" });
    }

    // 3. Update slot and reset status to pending
    appointment.slot = slot;
    appointment.status = "pending";
    await appointment.save();

    res.status(200).json({ message: "Appointment rescheduled successfully", appointment });
  } catch (err) {
    res.status(500).json({ message: "Error rescheduling appointment", error: err.message });
  }
});

// Get student's appointments
router.get("/student", authenticateToken, requireRole("student"), async (req, res) => {
  try {
    const appointments = await Appointment.find({ studentId: req.user.id })
      .populate("studentId", "username")
      .populate("professorId", "username");
    res.status(200).json(appointments);
  } catch (err) {
    res.status(500).json({ message: "Error fetching appointments", error: err.message });
  }
});

// Get professor's appointments
router.get("/professor", authenticateToken, requireRole("professor"), async (req, res) => {
  try {
    const appointments = await Appointment.find({ professorId: req.user.id })
      .populate("studentId", "username")
      .populate("professorId", "username");
    res.status(200).json(appointments);
  } catch (err) {
    res.status(500).json({ message: "Error fetching appointments", error: err.message });
  }
});

module.exports = router;
