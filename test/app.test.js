// test/app.test.js
const request = require("supertest");
const express = require("express");

// Mock mongoose completely
jest.mock("mongoose", () => {
  const mockDb = {
    users: [],
    availabilities: [],
    appointments: []
  };

  const mongooseMock = {
    connect: jest.fn().mockResolvedValue(true),
    connection: {
      close: jest.fn().mockResolvedValue(true)
    },
    Schema: (() => {
      class Schema {
        constructor(definition) {
          this.definition = definition;
          this.methods = {};
          this.statics = {};
        }
        pre() {}
      }
      Schema.Types = {
        ObjectId: 'ObjectId'
      };
      return Schema;
    })(),
    model: (modelName, schema) => {
      const collectionKey = modelName.toLowerCase() + "s";
      
      class MockModel {
        constructor(data) {
          Object.assign(this, data);
          if (!this._id) {
            this._id = new mongooseMock.Types.ObjectId().toString();
          }
          if (modelName === 'Appointment' && !this.status) {
            this.status = 'pending';
          }
        }

        async save() {
          if (modelName === 'User') {
            const bcrypt = require('bcryptjs');
            const exists = mockDb.users.some(u => u._id === this._id);
            if (!exists) {
              const salt = await bcrypt.genSalt(10);
              this.password = await bcrypt.hash(this.password, salt);
            }
          }
          const index = mockDb[collectionKey].findIndex(item => item._id.toString() === this._id.toString());
          if (index !== -1) {
            mockDb[collectionKey][index] = this;
          } else {
            mockDb[collectionKey].push(this);
          }
          return this;
        }

        async comparePassword(candidatePassword) {
          const bcrypt = require('bcryptjs');
          return bcrypt.compare(candidatePassword, this.password);
        }
      }

      MockModel.findOne = jest.fn().mockImplementation(async (query) => {
        return mockDb[collectionKey].find(item => {
          for (let key in query) {
            if (key === '_id') {
              if (query[key] && typeof query[key] === 'object' && query[key].$ne) {
                if (item._id.toString() === query[key].$ne.toString()) return false;
              } else if (item._id.toString() !== query[key].toString()) {
                return false;
              }
            } else if (key.includes('.')) {
              const parts = key.split('.');
              let val = item;
              for (let p of parts) {
                val = val ? val[p] : undefined;
              }
              if (val !== query[key]) return false;
            } else if (key === 'status' && query[key] && typeof query[key] === 'object' && query[key].$in) {
              if (!query[key].$in.includes(item.status)) return false;
            } else if (item[key] !== query[key]) {
              if (item[key] && query[key] && item[key].toString() === query[key].toString()) {
                continue;
              }
              return false;
            }
          }
          return true;
        }) || null;
      });

      MockModel.find = jest.fn().mockImplementation(async (query) => {
        return mockDb[collectionKey].filter(item => {
          for (let key in query) {
            if (item[key] !== query[key]) {
              if (item[key] && query[key] && item[key].toString() === query[key].toString()) {
                continue;
              }
              return false;
            }
          }
          return true;
        });
      });

      MockModel.findById = jest.fn().mockImplementation(async (id) => {
        return mockDb[collectionKey].find(item => item._id.toString() === id.toString()) || null;
      });

      MockModel.deleteMany = jest.fn().mockImplementation(async () => {
        mockDb[collectionKey] = [];
        return { deletedCount: 0 };
      });

      MockModel.updateMany = jest.fn().mockImplementation(async (query, update) => {
        let updatedCount = 0;
        mockDb[collectionKey].forEach(item => {
          let isMatch = true;
          for (let qKey in query) {
            if (qKey === '_id') {
              if (query[qKey] && typeof query[qKey] === 'object' && query[qKey].$ne) {
                if (item._id.toString() === query[qKey].$ne.toString()) isMatch = false;
              } else if (item._id.toString() !== query[qKey].toString()) {
                isMatch = false;
              }
            } else if (qKey.includes('.')) {
              const parts = qKey.split('.');
              let val = item;
              for (let p of parts) {
                val = val ? val[p] : undefined;
              }
              if (val !== query[qKey]) isMatch = false;
            } else if (item[qKey] !== query[qKey]) {
              if (item[qKey] && query[qKey] && item[qKey].toString() === query[qKey].toString()) {
                continue;
              }
              isMatch = false;
            }
          }
          
          if (isMatch) {
            if (update && update.$set) {
              Object.assign(item, update.$set);
            }
            updatedCount++;
          }
        });
        return { matchedCount: updatedCount, modifiedCount: updatedCount };
      });

      return MockModel;
    },
    Types: {
      ObjectId: class {
        constructor(id) {
          this.id = id || Math.random().toString(16).substring(2, 10) + 'a000000000000000';
        }
        toString() {
          return this.id;
        }
      }
    }
  };

  return mongooseMock;
});

const mongoose = require("mongoose");
const authRoute = require("../routes/auth");
const appointmentRoute = require("../routes/appointment");
const availabilityRoute = require("../routes/availability");
const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Availability = require("../models/Availability");

const app = express();
app.use(express.json());
app.use("/auth", authRoute);
app.use("/appointments", appointmentRoute);
app.use("/availability", availabilityRoute);

beforeAll(async () => {
  await mongoose.connect("dummy-connection-string");
  await User.deleteMany({});
  await Appointment.deleteMany({});
  await Availability.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe("College Appointment System E2E with Auth (Mocked DB)", () => {
  let studentToken, profToken, studentToken2;
  let studentId, profId, studentId2;
  let appointmentId;

  const slot1 = { start: "2025-06-21T10:00", end: "2025-06-21T10:30" };
  const slot2 = { start: "2025-06-21T11:00", end: "2025-06-21T11:30" };

  it("Registers a student and a professor", async () => {
    const resStud = await request(app)
      .post("/auth/register")
      .send({ username: "student1", password: "password123", role: "student" });
    expect(resStud.statusCode).toBe(201);
    studentId = resStud.body.userId;

    const resProf = await request(app)
      .post("/auth/register")
      .send({ username: "prof1", password: "password123", role: "professor" });
    expect(resProf.statusCode).toBe(201);
    profId = resProf.body.userId;

    const resStud2 = await request(app)
      .post("/auth/register")
      .send({ username: "student2", password: "password123", role: "student" });
    expect(resStud2.statusCode).toBe(201);
    studentId2 = resStud2.body.userId;
  });

  it("Logs in the registered users and gets tokens", async () => {
    const resStud = await request(app)
      .post("/auth/login")
      .send({ username: "student1", password: "password123" });
    expect(resStud.statusCode).toBe(200);
    studentToken = resStud.body.token;

    const resProf = await request(app)
      .post("/auth/login")
      .send({ username: "prof1", password: "password123" });
    expect(resProf.statusCode).toBe(200);
    profToken = resProf.body.token;

    const resStud2 = await request(app)
      .post("/auth/login")
      .send({ username: "student2", password: "password123" });
    expect(resStud2.statusCode).toBe(200);
    studentToken2 = resStud2.body.token;
  });

  it("Fails when setting availability without a token or with a student token", async () => {
    const resNoToken = await request(app)
      .post("/availability")
      .send({ slots: [slot1, slot2] });
    expect(resNoToken.statusCode).toBe(401);

    const resStudToken = await request(app)
      .post("/availability")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ slots: [slot1, slot2] });
    expect(resStudToken.statusCode).toBe(403);
  });

  it("Professor prof1 sets availability", async () => {
    const res = await request(app)
      .post("/availability")
      .set("Authorization", `Bearer ${profToken}`)
      .send({ slots: [slot1, slot2] });
    expect(res.statusCode).toBe(200);
    expect(res.body.availability.slots.length).toBe(2);
  });

  it("Student student1 books slot1 with Professor prof1 (status should be pending)", async () => {
    const res = await request(app)
      .post("/appointments")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ professorId: profId, slot: slot1 });
    expect(res.statusCode).toBe(201);
    expect(res.body.appointment.status).toBe("pending");
    appointmentId = res.body.appointment._id;
  });

  it("Student student2 books slot1 while student1's request is pending (should succeed)", async () => {
    const res = await request(app)
      .post("/appointments")
      .set("Authorization", `Bearer ${studentToken2}`)
      .send({ professorId: profId, slot: slot1 });
    expect(res.statusCode).toBe(201);
  });

  it("Professor prof1 confirms student1's appointment (and auto-cancels student2's pending appointment)", async () => {
    const res = await request(app)
      .patch(`/appointments/${appointmentId}/confirm`)
      .set("Authorization", `Bearer ${profToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.appointment.status).toBe("confirmed");
  });

  it("Student student2 tries to book slot1 now that it is confirmed (should return 409 conflict)", async () => {
    const res = await request(app)
      .post("/appointments")
      .set("Authorization", `Bearer ${studentToken2}`)
      .send({ professorId: profId, slot: slot1 });
    expect(res.statusCode).toBe(409);
  });

  it("Student student1 reschedules appointment to slot2 (should revert to pending and make slot1 free again)", async () => {
    const res = await request(app)
      .patch(`/appointments/${appointmentId}/reschedule`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ slot: slot2 });
    expect(res.statusCode).toBe(200);
    expect(res.body.appointment.slot.start).toBe(slot2.start);
    expect(res.body.appointment.status).toBe("pending");
  });

  it("Student student2 books slot1 now that it is free again", async () => {
    const res = await request(app)
      .post("/appointments")
      .set("Authorization", `Bearer ${studentToken2}`)
      .send({ professorId: profId, slot: slot1 });
    expect(res.statusCode).toBe(201);
  });

  it("Student student1 cancels rescheduled appointment", async () => {
    const res = await request(app)
      .patch(`/appointments/${appointmentId}/cancel`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.appointment.status).toBe("cancelled");
  });
});
