// Development helper. Pass an installed sharp module path as the first argument.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require(process.argv[2] || 'sharp');
(async()=>{
  const assets = path.join(__dirname,'../assets');
  const source = await fs.readFile(path.join(assets,'icon.svg'));
  for(const size of [192,512])await sharp(source).resize(size,size).png().toFile(path.join(assets,`icon-${size}.png`));
  const inner = await sharp(source).resize(340,340).png().toBuffer();
  await sharp({create:{width:512,height:512,channels:4,background:'#7660ce'}}).composite([{input:inner,left:86,top:86}]).png().toFile(path.join(assets,'icon-maskable.png'));
  console.log('Generated 192px, 512px and maskable app icons.');
})().catch(error=>{console.error(error);process.exitCode=1;});
