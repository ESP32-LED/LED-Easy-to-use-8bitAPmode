const destinationWidth = 81;
const matrixWidth = led.width;
const matrixHeight = led.height;
const areaLeft = 48;
const areaRight = 128;
const areaTop = 16;
const areaBottom = 32;

// スクロール文字専用Canvas
const scrollTextCanvas = document.createElement("canvas");
const scrollTextCtx = scrollTextCanvas.getContext("2d");

const cacheCanvas = document.createElement("canvas");
const cacheCtx = cacheCanvas.getContext("2d");

let scrollTextWidth = 0;
scrollX = areaRight;