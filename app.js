require('dotenv').config();
console.log("GIRIJA TEST 123");
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const authRoute = require("./routes/auth");
const availabilityRoute = require("./routes/availability");
const appointmentRoute = require("./routes/appointment");


const app = express();

app.use(bodyParser.json());
app.use(express.static('public'));
app.use("/auth", authRoute);
app.use("/availability", availabilityRoute);
app.use("/appointments", appointmentRoute);

const User = require('./models/User');
const Appointment = require('./models/Appointment');
const Availability = require('./models/Availability');

function enableMockMode() {
  console.log("\n⚠️  WARNING: Switching to IN-MEMORY DATABASE MODE (Offline Fallback)...");
  console.log("All data will be saved temporarily in server memory and will reset when the server restarts.\n");
  
  const mockDb = {
    users: [],
    availabilities: [],
    appointments: []
  };

  const models = [
    { name: 'User', model: User, key: 'users' },
    { name: 'Appointment', model: Appointment, key: 'appointments' },
    { name: 'Availability', model: Availability, key: 'availabilities' }
  ];

  models.forEach(({ name, model, key }) => {
    // Override prototype save
    model.prototype.save = async function() {
      if (!this._id) {
        this._id = new mongoose.Types.ObjectId();
      }
      
      // Hook for password hashing
      if (name === 'User' && this.password && !this.password.startsWith('$2a$')) {
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
      }
      
      const index = mockDb[key].findIndex(item => item._id.toString() === this._id.toString());
      if (index !== -1) {
        mockDb[key][index] = this;
      } else {
        mockDb[key].push(this);
      }
      return this;
    };

    // Override comparePassword for User prototype
    if (name === 'User') {
      model.prototype.comparePassword = async function(candidatePassword) {
        const bcrypt = require('bcryptjs');
        return bcrypt.compare(candidatePassword, this.password);
      };
    }

    // Override statics
    model.findOne = function(query) {
      const getMatched = () => {
        return mockDb[key].find(item => {
          for (let qKey in query) {
            if (qKey === '_id') {
              if (query[qKey] && typeof query[qKey] === 'object' && query[qKey].$ne) {
                if (item._id.toString() === query[qKey].$ne.toString()) return false;
              } else if (item._id.toString() !== query[qKey].toString()) {
                return false;
              }
            } else if (qKey.includes('.')) {
              const parts = qKey.split('.');
              let val = item;
              for (let p of parts) {
                val = val ? val[p] : undefined;
              }
              if (val !== query[qKey]) return false;
            } else if (qKey === 'status' && query[qKey] && typeof query[qKey] === 'object' && query[qKey].$in) {
              if (!query[qKey].$in.includes(item.status)) return false;
            } else if (item[qKey] !== query[qKey]) {
              if (item[qKey] && query[qKey] && item[qKey].toString() === query[qKey].toString()) {
                continue;
              }
              return false;
            }
          }
          return true;
        }) || null;
      };

      const result = getMatched();
      const promiseObj = Promise.resolve(result);
      promiseObj.select = function() {
        return this;
      };
      return promiseObj;
    };

    model.find = function(query) {
      const getFiltered = () => {
        if (!query || Object.keys(query).length === 0) return mockDb[key];
        return mockDb[key].filter(item => {
          for (let qKey in query) {
            if (item[qKey] !== query[qKey]) {
              if (item[qKey] && query[qKey] && item[qKey].toString() === query[qKey].toString()) {
                continue;
              }
              return false;
            }
          }
          return true;
        });
      };

      const result = getFiltered();
      const promiseObj = Promise.resolve(result);
      promiseObj.select = function() {
        return this;
      };
      return promiseObj;
    };

    model.findById = async function(id) {
      return mockDb[key].find(item => item._id.toString() === id.toString()) || null;
    };

    model.deleteMany = async function() {
      mockDb[key] = [];
      return { deletedCount: 0 };
    };

    model.updateMany = async function(query, update) {
      let updatedCount = 0;
      mockDb[key].forEach(item => {
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
    };
  });
}

console.log("APP FILE RUNNING");


const mongoURI = process.env.MONGODB_URI || "mongodb://girijasinghal1607_db_user:6NShJnsnkJaNzqP2@ac-ckmgeip-shard-00-00.qfbwu49.mongodb.net:27017,ac-ckmgeip-shard-00-01.qfbwu49.mongodb.net:27017,ac-ckmgeip-shard-00-02.qfbwu49.mongodb.net:27017/test?ssl=true&authSource=admin&retryWrites=true&w=majority";

mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 })

  .then(() => {
    console.log("✅ MongoDB Connected");
  })
  .catch((err) => {
    console.log("❌ MongoDB connection error:", err.message || err);
    enableMockMode();
  });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
