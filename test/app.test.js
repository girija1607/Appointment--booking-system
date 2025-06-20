// test/app.test.js
const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const session = require("express-session");

const appointmentRoute = require("../routes/appointment");
const availabilityRoute = require("../routes/availability");
const Appointment = require("../models/Appointment");
const Availability = require("../models/Availability");

const app = express();
app.use(bodyParser.json());
app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: true }));
app.use("/appointments", appointmentRoute);
app.use("/availability", availabilityRoute);

beforeAll(async () => {
  await mongoose.connect("mongodb://127.0.0.1:27017/test-db", {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  await Appointment.deleteMany({});
  await Availability.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe("College Appointment System E2E", () => {
  const A1 = "68554e671b4063c4a25d3d6b";
  const A2 = "68554e851b4063c4a25d3d6c";
  const P1 = "68554e991b4063c4a25d3d6e";
  const slot1 = { start: "2025-06-21T10:00", end: "2025-06-21T10:30" };
  const slot2 = { start: "2025-06-21T11:00", end: "2025-06-21T11:30" };
  let a1AppointmentId;

  it("Professor P1 sets availability", async () => {
    const res = await request(app)
      .post("/availability")
      .send({ professorId: P1, slots: [slot1, slot2] });
    expect(res.statusCode).toBe(200);
    expect(res.body.availability.slots.length).toBeGreaterThanOrEqual(2);
  });

  it("Student A1 books slot1 with Professor P1", async () => {
    const res = await request(app)
      .post("/appointments")
      .send({ studentId: A1, professorId: P1, slot: slot1 });
    expect(res.statusCode).toBe(201);
    a1AppointmentId = res.body.appointment._id;
  });

  it("Student A2 books slot2 with Professor P1", async () => {
    const res = await request(app)
      .post("/appointments")
      .send({ studentId: A2, professorId: P1, slot: slot2 });
    expect(res.statusCode).toBe(201);
  });

  it("Professor P1 cancels A1's appointment", async () => {
    const res = await request(app)
      .patch(`/appointments/${a1AppointmentId}/cancel`);
    expect(res.statusCode).toBe(200);
    expect(res.body.appointment.status).toBe("cancelled");
  });

  it("Student A1 checks appointments (should be none)", async () => {
    const res = await request(app)
      .get(`/appointments/student/${A1}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(0);
  });
});
