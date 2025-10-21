import mongoose, { Mongoose } from "mongoose";

main()
  .catch((err) => console.log(err))
  .then(() => {
    console.log("connected successfully");
  });

async function main() {
  await mongoose.connect("mongodb://127.0.0.1:27017/collage");
}

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  age: Number,
});

const User = mongoose.model("User", userSchema);

const user1 = new User({ name: "varad", email: "varad@gmail.com", age: 23 });

(async () => {
  await user1.save();
})();
