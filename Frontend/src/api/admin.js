import axios from "axios";

const APIADMIN = axios.create({
  baseURL: "http://localhost:5000/admin",
  withCredentials: true,
});

export default APIADMIN;
