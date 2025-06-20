const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const availabilityRoute = require("./routes/availability");
const appointmentRoute = require("./routes/appointment");

const app = express();
app.use(bodyParser.json());
app.use(session({ secret: 'college-secret', resave: false, saveUninitialized: true }));
app.use("/availability", availabilityRoute);
app.use("/appointments", appointmentRoute);


mongoose.connect("mongodb+srv://Girija:Singhal@cluster0.xaaeb4c.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",{
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch((err) => console.error('❌ MongoDB connection error:', err));


app.listen(3000, () => console.log('Server running on port 3000'));
