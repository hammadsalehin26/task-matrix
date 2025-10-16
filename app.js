// jshint esversion:6

// ======================= MODULE IMPORTS =======================
const express = require("express");      // Web framework for routing
const bodyParser = require("body-parser"); // Middleware for parsing POST request bodies
const mongoose = require("mongoose");    // ODM for MongoDB
const _ = require("lodash");             // Utility library for string manipulation

// ======================= APP INITIALIZATION =======================
const app = express();
const path = require("path");
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");            // Set EJS for templating

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));        // Serve static assets

// ======================= DATABASE CONNECTION =======================
mongoose.connect("mongodb://127.0.0.1:27017/todolistDB")
  .then(() => console.log("MongoDB connected successfully"))
  .catch(err => console.log("MongoDB connection error:", err));


// ======================= MONGOOSE SCHEMAS =======================
// Individual task item schema
const itemsSchema = { name: String };
const Item = mongoose.model("Item", itemsSchema);

// Default tasks to populate an empty list
const defaultItems = [
  new Item({ name: "Welcome to your Task-Matrix!" }),
  new Item({ name: "Use the + button to add a new task." }),
  new Item({ name: "<-- Check this to remove a task." })
];

// Custom list schema with embedded tasks
const listSchema = { name: String, items: [itemsSchema] };
const List = mongoose.model("List", listSchema);

// ======================= ROUTES =======================

// Home route - display default "Today" list
app.get("/", async (req, res) => {
  try {
    const foundItems = await Item.find({});

    // If no items exist, populate default tasks
    if (!foundItems || foundItems.length === 0) {
      await Item.insertMany(defaultItems);
      console.log("Default items inserted into DB");
      return res.redirect("/");
    }

    // Render list with items
    res.render("list", { listTitle: "Today", newListItems: foundItems });

  } catch (err) {
    console.error("Error fetching items:", err);
    res.status(500).send("Database error. Please check the server logs.");
  }
});

// Dynamic route for custom lists
app.get("/:customListName", async (req, res) => {
  const customListName = _.capitalize(req.params.customListName);

  try {
    let foundList = await List.findOne({ name: customListName });

    if (!foundList) {
      // Create a new custom list if it doesn't exist
      const list = new List({ name: customListName, items: defaultItems });
      await list.save();
      return res.redirect("/" + customListName);
    }

    // Render existing custom list
    res.render("list", { listTitle: foundList.name, newListItems: foundList.items || [] });

  } catch (err) {
    console.error("Error handling custom list:", err);
    res.status(500).send("Database error. Please check the server logs.");
  }
});

// Add new task
app.post("/", async (req, res) => {
  const itemName = req.body.newItem;
  const listName = req.body.list;

  const item = new Item({ name: itemName });

  try {
    if (listName === "Today") {
      await item.save();
      res.redirect("/");
    } else {
      const foundList = await List.findOne({ name: listName });
      if (!foundList) return res.redirect("/"); // Safety check
      foundList.items.push(item);
      await foundList.save();
      res.redirect("/" + listName);
    }
  } catch (err) {
    console.error("Error adding new task:", err);
    res.status(500).send("Database error. Could not add task.");
  }
});

// Delete task
app.post("/delete", async (req, res) => {
  const checkedItemId = req.body.checkbox;
  const listName = req.body.listName;

  try {
    if (listName === "Today") {
      // Use findByIdAndDelete instead of findByIdAndRemove
      await Item.findByIdAndDelete(checkedItemId);
      console.log("Task deleted from Today list:", checkedItemId);
      res.redirect("/");
    } else {
      // Delete from custom list
      await List.findOneAndUpdate(
        { name: listName },
        { $pull: { items: { _id: checkedItemId } } }
      );
      console.log(`Task deleted from custom list: ${listName}, id: ${checkedItemId}`);
      res.redirect("/" + listName);
    }
  } catch (err) {
    console.error("Error deleting task:", err);
    res.status(500).send("Database error. Could not delete task.");
  }
});

// About page
app.get("/about", (req, res) => {
  res.render("about");
});

// ======================= SERVER =======================
app.listen(3000, () => console.log("Server running on port 3000"));

// ======================= TECHNICAL NOTES =======================
// 1. Async/await ensures sequential DB operations and avoids callback hell.
// 2. Added safety checks to prevent 'undefined' errors when querying MongoDB.
// 3. $pull operator efficiently deletes nested array items in a single operation.
// 4. Modular route handling supports scalable additions of features.
