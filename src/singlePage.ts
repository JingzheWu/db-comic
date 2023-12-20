import {
  downloadImg,
  getDomainFromUrl,
  getHtml,
  removeLineBreak,
} from './util';
import { IPage } from './chapter';
import { Logger } from './logger';

const findImg = (html: string, url: string): string => {
  const domain = getDomainFromUrl(url);
  const htmlStr = removeLineBreak(html);
  const containerReg = /<div class="dapage" id="h_read">(.*?)<\/div>/;
  const linkReg = /<a href=['"]\/cn\/page-\d+\.html#h_read['"]>(.*?)<\/a>/g;
  let container = containerReg.exec(htmlStr);
  const linkContainer = linkReg.exec(htmlStr);
  container = container || linkContainer;
  if (!container) {
    Logger.error('htmlStr', htmlStr);
    throw new Error('未找到图片 Container, url:' + url);
  }
  const imgReg = /<img src="(.*?)"/;
  const backgroundImgReg = /background-image:url\((.*?)\)/;

  const containerStr = removeLineBreak(container[1]);
  let image = imgReg.exec(containerStr);
  image = image || backgroundImgReg.exec(containerStr);
  if (!image) {
    const linkContainerStr = removeLineBreak(
      (linkContainer as RegExpExecArray)[1]
    );
    image = imgReg.exec(linkContainerStr);
    image = image || backgroundImgReg.exec(linkContainerStr);
  }
  if (!image) {
    Logger.error('containerStr', containerStr);
    Logger.error('htmlStr', htmlStr);
    throw new Error('未找到图片, url:' + url);
  }
  return domain + image[1];
};

export const downloadImgFromSinglePageUrl = async (
  url: string,
  path: string
): Promise<void> => {
  const html = await getHtml(url);
  const imgUrl = findImg(html, url);
  await downloadImg(imgUrl, path);
};

export const downloadImgsFromPagesUrl = async (
  pages: IPage[],
  rootPath: string,
  concurrent?: boolean
): Promise<void> => {
  if (concurrent) {
    await Promise.all(
      pages.map(page => {
        const path = `${rootPath}/Page-${page.pageNum}.jpg`;
        return downloadImgFromSinglePageUrl(page.url, path);
      })
    );
    return;
  }
  for (const page of pages) {
    const path = `${rootPath}/Page-${page.pageNum}.jpg`;
    await downloadImgFromSinglePageUrl(page.url, path);
  }
};
