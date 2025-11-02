import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/auth.css";
import "./index.css";
import "./App.css";
import { Provider } from "react-redux";
import store from "./features/app/store";

ReactDOM.createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <App />
  </Provider>
);
