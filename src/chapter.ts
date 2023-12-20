import * as fs from 'fs-extra';
import { getDomainFromUrl, getHtml, removeLineBreak, unescape } from './util';
import { DB_COMIC_URL } from './const';
import { Logger } from './logger';

interface IChapter {
  chapterNum: number;
  title: string;
  url: string;
}

export interface IPage {
  pageNum: number;
  url: string;
}

export interface IChapterWithDetail extends IChapter {
  pages: IPage[];
}

export interface IChapterDetailJsonFile {
  updateTimestamp: number;
  updateTimeFormatted: string;
  chaptersLength: number;
  chapters: IChapterWithDetail[];
}

const getAllChapters = async (url: string): Promise<IChapter[]> => {
  const domain = getDomainFromUrl(url);
  let html = await getHtml(url);
  html = removeLineBreak(html);
  const chapterReg = /num_chapter="(.*?)">(.*?)<\/div>/g;
  const chapters: IChapter[] = [];
  let result;
  while ((result = chapterReg.exec(html))) {
    const linkReg = /<a href="(.*?)"/;
    const link = linkReg.exec(result[2]);
    if (!link) {
      throw new Error('未找到章节链接, url:' + result[2]);
    }
    const titleReg = /h4>(.*?)<\/h4>/;
    const title = titleReg.exec(result[2]);
    if (!title) {
      throw new Error('未找到章节标题, url:' + result[2]);
    }
    chapters.push({
      chapterNum: parseInt(result[1]),
      title: title[1],
      url: `${domain}/cn/${unescape(link[1])}`,
    });
  }
  chapters.sort((a, b) => a.chapterNum - b.chapterNum);
  return chapters;
};

const getAllPagesOfOneChapter = async (url: string): Promise<IPage[]> => {
  const domain = getDomainFromUrl(url);
  let html = await getHtml(url);
  html = removeLineBreak(html);

  const pagesReg = /<div class="pageslist">(.*?)<\/div>/;
  const pagesStr = pagesReg.exec(html);
  if (!pagesStr) {
    throw new Error('未找到页面列表, url:' + url);
  }
  const pageReg = /<a href=['"](.*?)['"]/g;
  const pages: IPage[] = [];
  let result: RegExpExecArray | null;
  while ((result = pageReg.exec(removeLineBreak(pagesStr[1])))) {
    const pageUrl = result[1];
    // 'https://www.dragonball-multiverse.com/cn/page-22.html'
    const pageNumReg = /page-(\d+)\.html/;
    const pageNUm = pageNumReg.exec(pageUrl);
    if (!pageNUm) {
      throw new Error('未找到页面序号, url:' + pageUrl);
    }
    pages.push({
      pageNum: parseInt(pageNUm[1]),
      url: `${domain}/cn/${pageUrl}`,
    });
  }

  return pages;
};

const getAllChaptersWithDetail = async (
  url: string,
  existingChapters: IChapterWithDetail[]
): Promise<{ all: IChapterWithDetail[]; diff: IChapterWithDetail[] }> => {
  const current = [...existingChapters];
  current.sort((a, b) => a.chapterNum - b.chapterNum);
  const max = current[current.length - 1];

  let chapters = await getAllChapters(url);
  Logger.log(`获取章节列表成功, 当前官网最新章节数: ${chapters.length}`);
  chapters = chapters.filter(chapter => chapter.chapterNum >= max.chapterNum);
  Logger.log(
    '本地已存在的所有章节:',
    current.map(chapter => chapter.chapterNum)
  );
  Logger.log('本次需要下载的所有章节:', chapters);

  const chaptersWithDetail: IChapterWithDetail[] = [];
  await Promise.all(
    chapters.map(async chapter => {
      const pages = await getAllPagesOfOneChapter(chapter.url);
      Logger.log(
        `获取章节 ${chapter.chapterNum} 的页面列表成功, 页面数: ${pages.length}`
      );
      chaptersWithDetail.push({
        ...chapter,
        pages,
      });
    })
  );

  chaptersWithDetail.sort((a, b) => a.chapterNum - b.chapterNum);
  current.pop();
  const newChaptersWithDetail = [...current, ...chaptersWithDetail];
  return {
    all: newChaptersWithDetail,
    diff: chaptersWithDetail,
  };
};

export const fetchChapters = async (
  forceUpdateChapterDetail = false
): Promise<{ all: IChapterWithDetail[]; diff: IChapterWithDetail[] }> => {
  let existingChapters: IChapterWithDetail[] = [];
  if (!fs.existsSync('./results/details.json')) {
    Logger.log('未找到详情文件, 调用接口获取详情');
  } else {
    const res = fs.readFileSync('./results/details.json', 'utf-8');
    const parsed = JSON.parse(res) as IChapterDetailJsonFile;
    existingChapters = parsed.chapters;
    if (!forceUpdateChapterDetail) {
      Logger.log('找到详情文件, 跳过调用接口');
      return { all: existingChapters, diff: [] };
    }

    Logger.log('强制更新章节详情, 调用接口获取详情');
  }

  Logger.log('开始获取所有章节详情......地址:', DB_COMIC_URL);
  const { all, diff } = await getAllChaptersWithDetail(
    DB_COMIC_URL,
    existingChapters
  );
  Logger.success('获取所有章节详情成功!');

  // 把 details 作为 json 保存到文件中
  const now = new Date();
  const jsonFile: IChapterDetailJsonFile = {
    updateTimestamp: now.getTime(),
    updateTimeFormatted: now.toLocaleString(),
    chaptersLength: all.length,
    chapters: all,
  };
  fs.ensureDirSync('./results');
  fs.writeFileSync('./results/details.json', JSON.stringify(jsonFile, null, 2));
  Logger.success('保存章节详情文件成功');
  return { all, diff };
};
