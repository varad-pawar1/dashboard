import { createStore, combineReducers, applyMiddleware } from "redux";
import { thunk } from "redux-thunk";
import logger from "redux-logger";
import authReducer from "../auth/authReducer";
import adminReducer from "../auth/adminReducer";

const rootReducer = combineReducers({
  admin: adminReducer,
  auth: authReducer,
});

const store = createStore(rootReducer, applyMiddleware(thunk, logger));

export default store;
