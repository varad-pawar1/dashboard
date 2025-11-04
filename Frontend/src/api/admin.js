import axios from "axios";

const APIADMIN = axios.create({
  baseURL: `${import.meta.env.VITE_BACKEND_URL}/admin`,
  withCredentials: true,
});

export default APIADMIN;
