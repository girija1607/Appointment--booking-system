const express = require("express");
const router = express.Router();
const Availability = require("../models/Availability");

router.post("/", async (req, res) => {
  const { professorId, slots } = req.body;

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
    res.status(500).json({ message: "Error saving availability", error: err });
  }
});

router.get("/:professorId", async (req, res) => {
  const { professorId } = req.params;

  try {
    const availability = await Availability.findOne({ professorId });

    if (!availability) {
      return res.status(404).json({ message: "No availability found" });
    }

    res.status(200).json(availability.slots);
  } catch (err) {
    res.status(500).json({ message: "Error fetching availability", error: err });
  }
});

module.exports = router;
