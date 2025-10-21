import { legacy_createStore } from "redux";
import { CounterReducer } from "./reducer";
export const store = legacy_createStore(CounterReducer);
