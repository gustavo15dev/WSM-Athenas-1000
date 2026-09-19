import fs from 'fs';
const data = fs.readFileSync('src/assets/fonts/brother-signature.otf');
const b64 = data.toString('base64');
const css = `
@font-face {
  font-family: 'Brother Signature';
  src: url('data:font/opentype;base64,${b64}') format('opentype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
`;
fs.writeFileSync('src/font-face.css', css);
