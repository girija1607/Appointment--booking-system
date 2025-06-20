const express = require("express");
const router = express.Router();
const Appointment = require("../models/Appointment");
const Availability = require("../models/Availability");

router.post("/", async (req, res) => {
  const { studentId, professorId, slot } = req.body;

  try {
    // 1. Check if professor has this slot in their availability
    const availability = await Availability.findOne({ professorId });
    const isAvailable = availability?.slots.some(
      (s) => s.start === slot.start && s.end === slot.end
    );

    if (!isAvailable) {
      return res.status(400).json({ message: "Slot not available" });
    }

    // 2. Check if slot is already booked
    const existing = await Appointment.findOne({
      professorId,
      "slot.start": slot.start,
      status: "booked"
    });

    if (existing) {
      return res.status(409).json({ message: "Slot already booked" });
    }

    // 3. Create new appointment
    const appointment = new Appointment({
      studentId,
      professorId,
      slot
    });

    await appointment.save();
    res.status(201).json({ message: "Appointment booked", appointment });
  } catch (err) {
    res.status(500).json({ message: "Error booking appointment", error: err });
  }
});

// Cancel appointment by ID
router.patch("/:id/cancel", async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    appointment.status = "cancelled";
    await appointment.save();

    res.status(200).json({ message: "Appointment cancelled", appointment });
  } catch (err) {
    res.status(500).json({ message: "Error cancelling appointment", error: err });
  }
});
router.get("/student/:studentId", async (req, res) => {
  try {
    const appointments = await Appointment.find({
      studentId: req.params.studentId,
      status: "booked"
    });

    res.status(200).json(appointments);
  } catch (err) {
    res.status(500).json({ message: "Error fetching appointments", error: err });
  }
});


module.exports = router;
