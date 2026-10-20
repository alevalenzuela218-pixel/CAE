import "./styles/main.css";
import { mountApp } from "./ui/app";

const root = document.getElementById("app");
if (root) {
  mountApp(root).catch((err) => {
    console.error(err);
    root.innerHTML = `<pre style="padding:1rem;color:#b00">Error al iniciar:\n${err}</pre>`;
  });
}
