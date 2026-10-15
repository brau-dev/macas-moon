// RFC 5545: CRLF line endings and folding at no more than 75 octets per line.
// Continuation lines begin with one space. Never split a UTF-8 code point.
export function serializeIcal(lines: string[]): string {
  return lines.map((line) => {
    let output = "";
    let octets = 0;
    for (const character of line) {
      const size = Buffer.byteLength(character, "utf8");
      if (octets + size > 75) { output += "\r\n "; octets = 1; }
      output += character;
      octets += size;
    }
    return output;
  }).join("\r\n") + "\r\n";
}
