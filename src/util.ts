import * as https from 'https';
import * as fs from 'fs';
import imageSize from 'image-size';
import {
  PDFDocument,
  PDFImage,
  PDFPage,
  PDFPageDrawImageOptions,
  degrees,
} from 'pdf-lib';
import { Logger } from './logger';

export const removeLineBreak = (str: string): string => {
  return str.replace(/\n/g, '');
};

export const getDomainFromUrl = (url: string): string => {
  const reg = /(https?:\/\/.*?)\//g;
  const domain = reg.exec(url);
  if (!domain) {
    throw new Error('未找到域名, url:' + url);
  }
  return domain[1];
};

export const getHtml = async (url: string): Promise<string> => {
  return new Promise(resolve => {
    https
      .get(url, function (res) {
        let html = '';
        // 绑定data事件 回调函数 累加html片段
        res.on('data', function (data) {
          html += data;
        });

        res.on('end', function () {
          resolve(html);
        });
      })
      .on('error', err => {
        Logger.error('获取数据错误', err);
        throw err;
      });
  });
};

export const downloadImg = async (url: string, path: string): Promise<void> => {
  return new Promise(resolve => {
    https
      .get(url, function (res) {
        let imgData = '';
        //一定要设置response的编码为binary否则会下载下来的图片打不开
        res.setEncoding('binary');

        res.on('data', function (chunk) {
          imgData += chunk;
        });

        res.on('end', function () {
          fs.writeFile(path, imgData, 'binary', function (err) {
            if (err) {
              Logger.error('保存图片错误', err);
              throw err;
            }
            resolve();
          });
        });
      })
      .on('error', err => {
        Logger.error('获取图片错误', err);
        throw err;
      });
  });
};

const HTML_ENTITY_MAP: {
  escape: { [key: string]: string };
  unescape: { [key: string]: string };
} = {
  escape: {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  },
  unescape: {
    '&amp;': '&',
    '&apos;': "'",
    '&gt;': '>',
    '&lt;': '<',
    '&quot;': '"',
  },
};
const entityReg = {
  escape: RegExp('[' + Object.keys(HTML_ENTITY_MAP.escape).join('') + ']', 'g'),
  unescape: RegExp(
    '(' + Object.keys(HTML_ENTITY_MAP.unescape).join('|') + ')',
    'g'
  ),
};

// 将HTML转义为实体
export const escape = (html: string): string => {
  if (typeof html !== 'string') return '';
  return html.replace(entityReg.escape, function (match) {
    return HTML_ENTITY_MAP.escape[match];
  });
};

// 将实体转回为HTML
export const unescape = (str: string): string => {
  if (typeof str !== 'string') return '';
  return str.replace(entityReg.unescape, function (match) {
    return HTML_ENTITY_MAP.unescape[match];
  });
};

export const checkImgIsJpgOrPng = (
  imgPath: string
): { img: Buffer; isJpg: boolean; isPng: boolean } => {
  const img = fs.readFileSync(imgPath);
  const imgHeader = img.slice(0, 4).toString('hex');
  const isJpg = imgHeader === 'ffd8ffe0' || imgHeader === 'ffd8ffe1';
  const isPng = imgHeader === '89504e47';
  return {
    img,
    isJpg,
    isPng,
  };
};

export const filterDSStore = (files: string[]): string[] => {
  return files.filter(file => !file.endsWith('.DS_Store'));
};

export const trimRepeatPattern = (str: string, pattern: string): string => {
  return str.replace(new RegExp(`${pattern}+`, 'g'), pattern);
};

export const transformInvalidPathChar = (str: string): string => {
  const pattern = '-';
  const filtered = str.replace(/[/\\:*?"<>|\s]/g, pattern);
  return trimRepeatPattern(filtered, pattern);
};

export const renameFile = (oldPath: string, newPath: string): void => {
  fs.renameSync(oldPath, newPath);
};

export const checkImgDisplayDirection = (
  imgPath: string
): {
  direction: 'horizontal' | 'vertical';
  width: number;
  height: number;
} => {
  const { width = 0, height = 0 } = imageSize(imgPath);
  const direction = width > height ? 'horizontal' : 'vertical';
  return {
    direction,
    width,
    height,
  };
};

export const imgsToPdf = async (params: {
  imgsPath: string[];
  coverPath?: string;
  outputPath: string;
}): Promise<void> => {
  const { imgsPath, coverPath, outputPath } = params;
  try {
    const pdfDoc = await PDFDocument.create();
    const embedder = (imgPath: string): Promise<PDFImage> => {
      const { img, isJpg, isPng } = checkImgIsJpgOrPng(imgPath);
      if (isJpg) return pdfDoc.embedJpg(img);
      if (isPng) return pdfDoc.embedPng(img);
      throw new Error(`图片格式不正确, imgPath: ${imgPath}`);
    };
    const getDrawImageOptions = (
      imgPath: string,
      page: PDFPage
    ): PDFPageDrawImageOptions => {
      const { direction } = checkImgDisplayDirection(imgPath);
      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();
      const x = 0;
      const y = direction === 'horizontal' ? pageHeight : 0;
      const width = direction === 'horizontal' ? pageHeight : pageWidth;
      const height = direction === 'horizontal' ? pageWidth : pageHeight;
      const rotate = direction === 'horizontal' ? degrees(-90) : undefined;
      return { x, y, width, height, rotate };
    };

    if (coverPath) {
      const coverImg = await embedder(coverPath);
      const coverPage = pdfDoc.insertPage(0);
      const options = getDrawImageOptions(coverPath, coverPage);
      coverPage.drawImage(coverImg, options);
    }

    for (const imgPath of imgsPath) {
      const img = await embedder(imgPath);
      const page = pdfDoc.addPage();
      const options = getDrawImageOptions(imgPath, page);
      page.drawImage(img, options);
    }

    const pdfBytes = await pdfDoc.save();
    const outputPathDir = outputPath.split('/').slice(0, -1).join('/');
    fs.existsSync(outputPathDir) || fs.mkdirSync(outputPathDir);
    fs.writeFileSync(outputPath, pdfBytes);
  } catch (error) {
    Logger.error(`生成PDF${outputPath}失败`, error);
  }
};

export const getParamsFromCmdLine = (): { [key: string]: string } => {
  const args = process.argv.slice(2);
  const params: { [key: string]: string } = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        params[key] = value;
        i++;
      } else {
        params[key] = 'true';
      }
    }
  }
  return params;
};
