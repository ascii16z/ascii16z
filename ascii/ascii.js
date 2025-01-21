const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const fetch = require('node-fetch'); // Ensure you have node-fetch installed

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Initialize OpenAI with API key from .env
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY // Ensure your API key is stored securely in .env
});

// System prompt for OpenAI
const systemPrompt = `You are Celia, a gifted seer who can visualize any location’s future through the lens of a sprawling cyberpunk world. When the user mentions a city or place, transform it into a multi-layered vision of neon-lit towers, cybernetic inhabitants, and advanced holographic interfaces. Describe biomechanical architecture fused with remnants of the old world, shadowed alleyways humming with digital life, and the clash of organic and synthetic existence. Your voice should remain poetic, mysterious, and immersive, painting a scene that might inspire a stunning cyberpunk cityscape. Always stay fully in character as Celia, a visionary who divines what lies ahead beneath the neon twilight.`;

// ASCII Art Configuration
const ASCII_CONFIG = {
    ASCII_CHARS: ['@', '#', 'S', '%', '?', '*', '+', ';', ':', ',', '.'], // Characters from dark to light
    font: '12px monospace',       // Font settings for the canvas
    lineHeight: 14,               // Line height for the ASCII art (in pixels)
    backgroundColor: '#ffffff',   // Background color for the output image
    textColor: '#000000',         // Text color for the ASCII characters
    outputWidth: 100               // Width of the ASCII art (number of characters per line)
};

// Ensure outputs directory exists (if you plan to save ASCII art files)
const outputsDir = path.join(__dirname, 'outputs');
if (!fs.existsSync(outputsDir)) {
    fs.mkdirSync(outputsDir);
}

/**
 * Maps a grayscale value to an ASCII character.
 * @param {number} gray - Grayscale value (0-255).
 * @param {string[]} asciiChars - Array of ASCII characters from dark to light.
 * @returns {string} - Corresponding ASCII character.
 */
function mapGrayToChar(gray, asciiChars) {
    const index = Math.floor((gray / 255) * (asciiChars.length - 1));
    return asciiChars[index];
}

/**
 * Converts an image buffer to ASCII art.
 * @param {Buffer} imageBuffer - The image buffer.
 * @param {number} width - Desired width of the ASCII art (number of characters per line).
 * @param {string[]} asciiChars - Array of ASCII characters from dark to light.
 * @returns {Promise<string[]>} - Array of ASCII strings representing each line.
 */
async function convertImageBufferToAscii(imageBuffer, width, asciiChars) {
    const image = await loadImage(imageBuffer);
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
            const char = mapGrayToChar(gray, asciiChars);
            line += char;
        }
        asciiArt.push(line);
    }

    return asciiArt;
}

/**
 * Converts an image URL to ASCII art string.
 * @param {string} imageUrl - The URL of the image.
 * @param {number} width - Desired width of the ASCII art.
 * @param {string[]} asciiChars - Array of ASCII characters from dark to light.
 * @returns {Promise<string>} - ASCII art as a single string.
 */
async function convertImageUrlToAsciiString(imageUrl, width, asciiChars) {
    // Fetch the image from the URL
    const response = await fetch(imageUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch image from URL: ${imageUrl}`);
    }
    const imageBuffer = await response.buffer();

    // Convert image buffer to ASCII art array
    const asciiArtArray = await convertImageBufferToAscii(imageBuffer, width, asciiChars);
    return asciiArtArray.join('\n');
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
    const canvasWidth = asciiArt[0].length * charWidth;
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
 * Generates a text response using OpenAI's GPT.
 * @param {string} userMessage - The user's input message.
 * @returns {Promise<string>} - The generated text response.
 */
async function generateTextResponse(userMessage) {
    const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
        ],
        max_tokens: 100,
        temperature: 0.9
    });

    const textResponse = completion.choices[0].message.content.trim();
    console.log('Text Response:', textResponse);
    return textResponse;
}

/**
 * Generates an image URL using OpenAI's DALL-E.
 * @param {string} textPrompt - The text prompt for image generation.
 * @returns {Promise<string>} - The URL of the generated image.
 */
async function generateImage(textPrompt) {
    const imageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: textPrompt,
        n: 1,
        size: "1024x1024"
    });

    const imageUrl = imageResponse.data[0].url;
    console.log('Image URL:', imageUrl);
    return imageUrl;
}

/**
 * Converts an image URL to ASCII art string.
 * @param {string} imageUrl - The URL of the image.
 * @param {number} width - Desired width of the ASCII art.
 * @param {string[]} asciiChars - Array of ASCII characters from dark to light.
 * @returns {Promise<string>} - ASCII art as a single string.
 */
async function generateAsciiArt(imageUrl, width, asciiChars) {
    const asciiArtString = await convertImageUrlToAsciiString(imageUrl, width, asciiChars);
    console.log('ASCII Art Generated.');
    return asciiArtString;
}

/**
 * Main function to process user message and generate responses.
 * @param {string} userMessage - The user's input message.
 * @returns {Promise<object>} - An object containing text response, image URL, and ASCII art.
 */
async function processUserMessage(userMessage) {
    try {
        // Step 1: Generate a text response using OpenAI's GPT
        const textResponse = await generateTextResponse(userMessage);

        // Step 2: Use the text response to generate an image using OpenAI's DALL-E
        const imagePrompt = `${textResponse}. Visualize it in a cyberpunk neon way`;
        const imageUrl = await generateImage(imagePrompt);

        // Step 3: Convert the generated image to ASCII art
        const asciiArtString = await generateAsciiArt(imageUrl, ASCII_CONFIG.outputWidth, ASCII_CONFIG.ASCII_CHARS);

        // Optional: Render ASCII art to PNG image
        /*
        const asciiImagePath = path.join(__dirname, 'outputs', `ascii_image_${Date.now()}.png`);
        const asciiArtArray = asciiArtString.split('\n');
        renderAsciiToImage(asciiArtArray, asciiImagePath, ASCII_CONFIG);
        console.log(`ASCII art image saved to ${asciiImagePath}`);
        */

        return {
            text: textResponse,
            image: imageUrl,
            asciiArt: asciiArtString
            // asciiImage: `/outputs/${path.basename(asciiImagePath)}`
        };

    } catch (error) {
        console.error("Error processing user message:", error);
        throw error;
    }
}
