import APIADMIN from "../../api/admin";
import {
  SET_FIELD,
  RESET_FORM,
  FETCH_DASHBOARD_REQUEST,
  FETCH_DASHBOARD_SUCCESS,
  FETCH_DASHBOARD_FAILURE,
  SEND_RESET_LINK_REQUEST,
  SEND_RESET_LINK_SUCCESS,
  SEND_RESET_LINK_FAILURE,
  RESET_PASSWORD_REQUEST,
  RESET_PASSWORD_SUCCESS,
  RESET_PASSWORD_FAILURE,
} from "./adminReducer";
// ---- Field Actions ----
export const setField = (field, value) => ({
  type: SET_FIELD,
  payload: { field, value },
});

export const resetForm = () => ({ type: RESET_FORM });

// ----- Fetch User -----
export const fetchDashboardData = () => async (dispatch) => {
  dispatch({ type: FETCH_DASHBOARD_REQUEST });
  try {
    const res = await APIADMIN.get("/me", { withCredentials: true });

    dispatch({
      type: FETCH_DASHBOARD_SUCCESS,
      payload: {
        user: res.data.adminLogin,
        admins: res.data.allAdmins,
        groups: res.data.groups,
      },
    });

    return res.data.adminLogin;
  } catch (err) {
    dispatch({
      type: FETCH_DASHBOARD_FAILURE,
      payload: "User not authenticated",
    });
    throw new Error("User not authenticated");
  }
};

// ----- Send Reset Link -----
export const sendResetLink = (email) => async (dispatch) => {
  dispatch({ type: SEND_RESET_LINK_REQUEST });
  try {
    const res = await APIADMIN.post(
      "/send-reset-link",
      { email },
      { withCredentials: true }
    );
    dispatch({ type: SEND_RESET_LINK_SUCCESS, payload: res.data.message });
    return res.data;
  } catch (err) {
    const message = err.response?.data?.message || "Failed to send reset link";
    dispatch({ type: SEND_RESET_LINK_FAILURE, payload: message });
    throw new Error(message);
  }
};

// ----- Reset Password -----
export const resetPasswordAction = (token, newPassword) => async (dispatch) => {
  dispatch({ type: RESET_PASSWORD_REQUEST });
  try {
    const res = await APIADMIN.post(`/reset-password/${token}`, {
      password: newPassword,
    });
    dispatch({ type: RESET_PASSWORD_SUCCESS, payload: res.data.message });
    return res.data;
  } catch (err) {
    const message = err.response?.data?.message || "Failed to reset password";
    dispatch({ type: RESET_PASSWORD_FAILURE, payload: message });
    throw new Error(message);
  }
};
