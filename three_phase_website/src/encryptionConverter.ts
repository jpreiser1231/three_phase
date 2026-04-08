export function pemToArrayBuffer(pem: string): ArrayBuffer {
    // Remove the PEM header, footer, and line breaks
    const base64 = pem
        .replace(/(-----(BEGIN|END) [A-Z ]+-----|\\n|\\r)/g, '')
        .trim();

    // Decode the Base64 string into a binary string
    const binaryString = window.atob(base64);
    const length = binaryString.length;
    const bytes = new Uint8Array(length);

    // Convert the binary string to a Uint8Array (which uses an ArrayBuffer under the hood)
    for (let i = 0; i < length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // Return the underlying ArrayBuffer
    return bytes.buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    // Create a Uint8Array view of the ArrayBuffer
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;

    // Manually convert bytes to a binary string
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }

    // Use the built-in btoa function to encode the binary string to Base64
    return window.btoa(binary);
}

export const importPublicKey = async (pem: string) => {
    // Clean the string more aggressively to ensure atob doesn't crash
    const base64 = pem
        .replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----/g, "")
        .replace(/\s/g, ""); // Removes all newlines (\n, \r) and spaces

    const binaryDerString = atob(base64);
    const binaryDer = Uint8Array.from(binaryDerString, c => c.charCodeAt(0));

    return await window.crypto.subtle.importKey(
        "spki",
        binaryDer.buffer,
        {
            name: "RSA-OAEP",
            hash: "SHA-256" // Keep this as SHA-256
        },
        true,
        ["encrypt"]
    );
};

