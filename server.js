const express = require("express");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

// import routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const categoryRoutes = require("./routes/category");
const linkRoutes = require("./routes/link");

const app = express();

// db
mongoose
  .connect(process.env.DATABASE_CLOUD, {})
  .then(() => console.log("DB connected"))
  .catch((err) => console.log("DB Error => ", err));

//app middlewares
app.use(morgan("dev"));
// app.use(bodyParser.json());
app.use(bodyParser.json({ limit: "5mb", type: "application/json" }));
// app.use(cors());
app.use(cors({ origin: process.env.CLIENT_URL }));

// middlewares
// app.use(express.json({ limit: "10KB" }));
app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api", categoryRoutes);
app.use("/api", linkRoutes);

const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`API is running on port ${port}`));
