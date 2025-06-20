const mongoose = require("mongoose");

const availabilitySchema = new mongoose.Schema({
  professorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  slots: [
    {
      start: String, // "2025-06-21T10:00"
      end: String    // "2025-06-21T10:30"
    }
  ]
});

module.exports = mongoose.model("Availability", availabilitySchema);
