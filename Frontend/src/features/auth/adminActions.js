import APIADMIN from "../../api/admin";
import {
  FETCH_USER_REQUEST,
  FETCH_USER_SUCCESS,
  FETCH_USER_FAILURE,
} from "./adminReducer";

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
