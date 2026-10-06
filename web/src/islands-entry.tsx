/** Islands entry for the prerendered public Home: mounts small interactive React roots
 *  into placeholders in the static markup. The surrounding page is server-rendered and
 *  never React-managed — the LCP paint is immune to hydration and bundle parsing. */
import "./styles/index.css";
import { mountHomeIslands } from "./features/home/mountHomeIslands";

mountHomeIslands();
