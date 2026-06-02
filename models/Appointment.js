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
    enum: ["pending", "confirmed", "cancelled"],
    default: "pending"
  }
});

module.exports = mongoose.model("Appointment", appointmentSchema);

