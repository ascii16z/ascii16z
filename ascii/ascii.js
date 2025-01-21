
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// ASCII characters used to build the output text
const ASCII_CHARS = ['@', '#', 'S', '%', '?', '*', '+', ';', ':', ',', '.'];

// Configuration
const CONFIG = {
    inputImagePath: 'input.png', // Path to your input image
    outputImagePath: 'output.png', // Path for the output PNG
    outputWidth: 300, // Width of the ASCII art (number of characters per line)
    font: '12px monospace', // Font settings for the canvas
    lineHeight: 14, // Line height for the ASCII art (in pixels)
    backgroundColor: '#ffffff', // Background color for the output image
    textColor: '#000000' // Text color for the ASCII characters
};

/**
 * Maps a grayscale value to an ASCII character.
 * @param {number} gray - Grayscale value (0-255).
 * @returns {string} - Corresponding ASCII character.
 */
function mapGrayToChar(gray) {
    const index = Math.floor((gray / 255) * (ASCII_CHARS.length - 1));
    return ASCII_CHARS[index];
}

/**
 * Converts an image to ASCII art.
 * @param {string} imagePath - Path to the input image.
 * @param {number} width - Desired width of the ASCII art (number of characters).
 * @returns {Promise<string[]>} - Array of ASCII strings representing each line.
 */
async function convertImageToAscii(imagePath, width) {
    const image = await loadImage(imagePath);
    const aspectRatio = image.height / image.width;
    const height = Math.floor(width * aspectRatio * 0.55); // Adjusting for character aspect ratio

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Draw the image onto the canvas
    ctx.drawImage(image, 0, 0, width, height);

    // Get pixel data
    const imageData = ctx.getImageData(0, 0, width, height).data;

    const asciiArt = [];
    for (let y = 0; y < height; y++) {
        let line = '';
        for (let x = 0; x < width; x++) {
            const offset = (y * width + x) * 4;
            const r = imageData[offset];
            const g = imageData[offset + 1];
            const b = imageData[offset + 2];
            // Calculate luminance using the Rec. 601 luma formula
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            const char = mapGrayToChar(gray);
            line += char;
        }
        asciiArt.push(line);
    }

    return asciiArt;
}

/**
 * Renders ASCII art onto a canvas and saves it as a PNG.
 * @param {string[]} asciiArt - Array of ASCII strings.
 * @param {string} outputPath - Path to save the PNG image.
 * @param {object} config - Configuration object.
 */
function renderAsciiToImage(asciiArt, outputPath, config) {
    // Create a temporary canvas to measure text
    const tempCanvas = createCanvas(0, 0);
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.font = config.font;
    const metrics = tempCtx.measureText('A');
    const charWidth = metrics.width;
    const charHeight = config.lineHeight; // Using predefined lineHeight

    // Determine canvas size based on ASCII art and character dimensions
    const canvasWidth = config.outputWidth * charWidth;
    const canvasHeight = asciiArt.length * charHeight;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Fill background
    ctx.fillStyle = config.backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Set text properties
    ctx.fillStyle = config.textColor;
    ctx.font = config.font;
    ctx.textBaseline = 'top';

    // Draw each line of ASCII art
    asciiArt.forEach((line, index) => {
        ctx.fillText(line, 0, index * charHeight);
    });

    // Write canvas to PNG
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`ASCII art image saved to ${outputPath}`);
}

/**
 * Main function to execute the ASCII art generation.
 */
async function main() {
    try {
        // Validate input image path
        if (!fs.existsSync(CONFIG.inputImagePath)) {
            console.error(`Input image not found at path: ${CONFIG.inputImagePath}`);
            process.exit(1);
        }

        console.log('Converting image to ASCII art...');
        const asciiArt = await convertImageToAscii(CONFIG.inputImagePath, CONFIG.outputWidth);

        console.log('Rendering ASCII art to image...');
        renderAsciiToImage(asciiArt, CONFIG.outputImagePath, CONFIG);

        console.log('Done!');
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

// Execute the main function
main();
