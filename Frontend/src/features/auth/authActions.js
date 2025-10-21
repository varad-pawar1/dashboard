// src/features/auth/authActions.js

import API from "../../api/auth";
import APIADMIN from "../../api/admin";
import {
  SET_FIELD,
  RESET_FORM,
  SIGNUP_REQUEST,
  SIGNUP_SUCCESS,
  SIGNUP_FAILURE,
  LOGIN_REQUEST,
  LOGIN_SUCCESS,
  LOGIN_FAILURE,
  FETCH_USER_REQUEST,
  FETCH_USER_SUCCESS,
  FETCH_USER_FAILURE,
  LOGOUT,
} from "./authReducer";

// ----- Action Creators -----

export const setField = (field, value) => ({
  type: SET_FIELD,
  payload: { field, value },
});

export const resetForm = () => ({ type: RESET_FORM });

// ----- Signup -----
export const signupUser = (data) => async (dispatch) => {
  dispatch({ type: SIGNUP_REQUEST });
  try {
    const res = await API.post("/signup", data);
    dispatch({ type: SIGNUP_SUCCESS });
    dispatch(resetForm());
    return res.data;
  } catch (err) {
    const message = err.response?.data?.message || "Signup failed";
    dispatch({ type: SIGNUP_FAILURE, payload: message });
    return Promise.reject(message);
  }
};

// ----- Login -----
export const loginUser = (data) => async (dispatch) => {
  dispatch({ type: LOGIN_REQUEST });
  try {
    const res = await API.post("/login", data, { withCredentials: true });
    dispatch({ type: LOGIN_SUCCESS, payload: res.data.user });
    dispatch(resetForm());
    return res.data.user;
  } catch (err) {
    const message = err.response?.data?.message || "Login failed";
    dispatch({ type: LOGIN_FAILURE, payload: message });
    return Promise.reject(message);
  }
};

// ----- Fetch User -----
export const fetchUser = () => async (dispatch) => {
  dispatch({ type: FETCH_USER_REQUEST });
  try {
    const res = await APIADMIN.get("/me", { withCredentials: true });
    dispatch({ type: FETCH_USER_SUCCESS, payload: res.data.user });
    return res.data.user;
  } catch (err) {
    dispatch({ type: FETCH_USER_FAILURE, payload: "User not authenticated" });
    return Promise.reject("User not authenticated");
  }
};

// ----- Logout -----
export const logout = () => async (dispatch) => {
  try {
    await API.post("/logout", {}, { withCredentials: true });
    dispatch({ type: LOGOUT });
  } catch (err) {
    console.error("Logout failed:", err);
    dispatch({ type: LOGOUT });
  }
};
