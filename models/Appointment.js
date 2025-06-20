const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  professorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  slot: {
    start: String,
    end: String
  },
  status: {
    type: String,
    enum: ["booked", "cancelled"],
    default: "booked"
  }
});

module.exports = mongoose.model("Appointment", appointmentSchema);

