const express = require("express");
const router = express.Router();
const Availability = require("../models/Availability");
const { authenticateToken, requireRole } = require("../middleware/auth");

// Only professors can set availability
router.post("/", authenticateToken, requireRole("professor"), async (req, res) => {
  const professorId = req.user.id;
  const { slots } = req.body;

  if (!slots || !Array.isArray(slots)) {
    return res.status(400).json({ message: "Slots must be an array" });
  }

  try {
    let availability = await Availability.findOne({ professorId });

    if (availability) {
      availability.slots = [...availability.slots, ...slots];
      await availability.save();
    } else {
      availability = new Availability({ professorId, slots });
      await availability.save();
    }

    res.status(200).json({ message: "Availability saved", availability });
  } catch (err) {
    res.status(500).json({ message: "Error saving availability", error: err.message });
  }
});

// Any authenticated user can check a professor's availability
router.get("/:professorId", authenticateToken, async (req, res) => {
  const { professorId } = req.params;

  try {
    const availability = await Availability.findOne({ professorId });

    if (!availability) {
      return res.status(404).json({ message: "No availability found" });
    }

    res.status(200).json(availability.slots);
  } catch (err) {
    res.status(500).json({ message: "Error fetching availability", error: err.message });
  }
});

module.exports = router;
