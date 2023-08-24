import "dotenv/config";
import { Midjourney } from "midjourney";
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { sep } from 'path';
import fs from 'fs';
import axios from 'axios';
import axiosRetry from 'axios-retry';

axiosRetry(axios, { retries: 3 });

async function download(uri: string, filename: string, callback?: any) {
  try {
    const response = await axios.get(uri, {
      responseType: 'arraybuffer'  // 确保数据以 buffer 格式接收
    });
    fs.writeFileSync(filename, response.data);
    console.log(`File saved to ${filename}`);
    callback && callback();
  } catch (error) {
    console.error(`Error downloading or saving the file (${filename}): ${error.message}`);
  }
};

/**
 * // 示例
 *    console.log(strPad('5', 4, '0', 'left'));        // '0005'
 *    console.log(strPad('hello', 10, '-', 'both'));   // '---hello--'
 *    console.log(strPad('world', 10, '*'));           // 'world*****' (默认是右填充)
 * @param input 
 * @param padLength 
 * @param padString 
 * @param padType 
 * @returns 
 */
function strPad(input, padLength, padString = ' ', padType = 'right') {
  const str = input.toString();

  if (str.length >= padLength) return str;

  const pad = new Array(padLength + 1).join(padString);

  switch (padType) {
      case 'left':
          return (pad + str).slice(-padLength);
      case 'both':
          const right = Math.ceil((padLength - str.length) / 2);
          const left = padLength - str.length - right;
          return (pad.slice(0, left) + str + pad.slice(0, right)).slice(0, padLength);
      case 'right':
      default:
          return (str + pad).substring(0, padLength);
  }
}

async function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function main() {
  const argv = yargs(hideBin(process.argv)).argv;
  console.log(argv);

  const prompt = argv.prompt;
  const file_prefix = (argv.prefix || "") ? `${argv.prefix}-` : "";
  const sequence = argv.sequence;
  const dest_dir = argv.dest ? argv.dest : "pics";
  await ensureDirectoryExists(dest_dir);

  const client = new Midjourney({
    ServerId: <string>process.env.SERVER_ID,
    ChannelId: <string>process.env.CHANNEL_ID,
    SalaiToken: <string>process.env.SALAI_TOKEN,
    Debug: true,
    Ws: true,
  });

  await client.Connect(); // required

  // step 1. /imagine
  var Imagine: any;
  while (true) {
    Imagine = await client.Imagine(
      prompt,
      (uri: string, progress: string) => {
        console.log("  >> Imagine.loading", uri, "progress", progress);
      }
    );
    if (!Imagine) {
      continue;
    }
    break;
  }

  // step 2. Upscale
  var Upscale: any;
  while (true) {
    Upscale = await client.Upscale({
      index: 1,
      msgId: <string>Imagine.id,
      hash: <string>Imagine.hash,
      flags: Imagine.flags,
      loading: (uri: string, progress: string) => {
        console.log("  >> Upscale.loading", uri, "progress", progress);
      },
    });

    if (!Upscale) {
      continue;
    }
    break;
  }

  // step 3. download Pic
  const dest = dest_dir + sep + file_prefix + strPad(sequence, 3, "0", "left") + '.png';
  await download(Upscale.uri, dest);

  client.Close();
}


main()
  .then(() => {
    // console.log("finished");
    // process.exit(0);
  })
  .catch((err) => {
    console.log("finished");
    console.error(err);
    process.exit(1);
  });
