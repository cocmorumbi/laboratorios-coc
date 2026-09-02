const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  dayKey: { type: String, required: true },
  title: { type: String, required: true },
  location: { type: String, required: true },
  time: { type: String, required: true }
}, { timestamps: true });

AppointmentSchema.index({ dayKey: 1, location: 1, time: 1 }, { unique: true });

module.exports = mongoose.model('Appointment', AppointmentSchema);