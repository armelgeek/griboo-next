import { svgPathProperties } from 'svg-path-properties';

const d = "M 0 0 L 100 0 L 100 100 L 0 100 Z";
const props = new svgPathProperties(d);
console.log("Properties keys:", Object.keys(props));
console.log("Prototype keys:", Object.keys(Object.getPrototypeOf(props)));

// Try common names
if ((props as any).getBounds) {
    console.log("getBounds exists!");
    console.log("Bounds:", (props as any).getBounds());
} else {
    console.log("getBounds does NOT exist.");
}
