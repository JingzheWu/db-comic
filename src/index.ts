import * as fs from 'fs';
import * as path from 'path';
import { IChapterWithDetail, IPage, fetchChapters } from './chapter';
import { downloadImgsFromPagesUrl } from './singlePage';
import {
  filterDSStore,
  getParamsFromCmdLine,
  imgsToPdf,
  transformInvalidPathChar,
} from './util';
import { Logger } from './logger';

const checkImageNumMatch = (dir: string, pages: IPage[]) => {
  Logger.log(`检查目录 ${dir} 下图片数量与详情页数量是否匹配`);
  const files = fs.readdirSync(dir);
  const existingImgs = files
    .filter(file => file.endsWith('.jpg') || file.endsWith('.png'))
    .map(file => file.split('.')[0].toLowerCase());
  if (existingImgs.length !== pages.length) {
    throw new Error(
      `目录 ${dir} 下图片数量 ${existingImgs.length} 与详情页数量 ${pages.length} 不匹配`
    );
  }
  const pageNumReg = /(page-\d+)\.html/;
  const expectedImages = pages.map(page => {
    const match = page.url.match(pageNumReg);
    if (!match) {
      throw new Error(`详情页 ${page.url} 不符合规则`);
    }
    return match[1].toLowerCase();
  });
  const isAllExist = expectedImages.every(expectedImage => {
    const isExist = existingImgs.includes(expectedImage);
    if (!isExist) {
      throw new Error(`目录 ${dir} 下不存在图片 ${expectedImage}`);
    }
    return isExist;
  });
  if (!isAllExist) {
    throw new Error(`目录 ${dir} 下图片与详情页不匹配`);
  }

  Logger.log(`Congratulations！目录 ${dir} 下图片检查通过！`);
  return true;
};

const download = async (params: {
  detail: IChapterWithDetail;
  concurrent?: boolean;
  needUpdate?: boolean;
}): Promise<void> => {
  const { detail, concurrent, needUpdate } = params;
  const { chapterNum, pages } = detail;
  const chapterPath = `./results/chapters/Chapter-${chapterNum}`;
  const metaFilePath = `${chapterPath}/meta.json`;
  Logger.start(`开始下载第 ${chapterNum} 章, 共 ${pages.length} 页`);

  if (needUpdate) {
    Logger.log(`当前章节需要更新, 删除 ${chapterPath}`);
    fs.existsSync(chapterPath) && fs.rmSync(chapterPath, { recursive: true });
  }

  if (fs.existsSync(metaFilePath)) {
    Logger.log(
      `第 ${chapterNum} 章已存在 ${metaFilePath}, 即将跳过下载当前章节`
    );
    checkImageNumMatch(chapterPath, pages);
    Logger.success(`跳过下载第 ${chapterNum} 章成功`);
    return;
  }

  fs.existsSync(chapterPath) || fs.mkdirSync(chapterPath);
  Logger.log(`创建目录 ${chapterPath} 成功`);
  await downloadImgsFromPagesUrl(pages, chapterPath, concurrent);

  fs.writeFileSync(metaFilePath, JSON.stringify(detail, null, 2));
  checkImageNumMatch(chapterPath, pages);
  Logger.log(`保存 ${metaFilePath} 成功`);
  Logger.success(`下载第 ${chapterNum} 章成功`);
};

const toPdf = async (params: {
  chaptersPath: string;
  chapter: string;
  /**
   * 是否强制更新章节详情(用于在网站更新后, 重新下载所有章节url), 默认为 false
   */
  shouldChapterSkipToPdf?: (chapter: string) => boolean;
  /**
   * 是否需要重新生成当前章节的 pdf
   */
  shouldUpdatePdf?: (chapter: string) => boolean;
}): Promise<void> => {
  const { chaptersPath, chapter, shouldChapterSkipToPdf, shouldUpdatePdf } =
    params;
  const chapterPath = path.resolve(chaptersPath, chapter);
  Logger.start(`开始转换 ${chapterPath} 为 pdf`);
  const metaFilePath = `${chapterPath}/meta.json`;
  const metaData: IChapterWithDetail = JSON.parse(
    fs.readFileSync(metaFilePath, 'utf-8')
  );
  const allImgs = filterDSStore(
    fs.readdirSync(chapterPath).filter(file => {
      return file.endsWith('.jpg') || file.endsWith('.png');
    })
  );
  // ['page-0.jpg', 'page-1.jpg', 'page-2.jpg', 'page-3.jpg']
  allImgs.sort((a, b) => {
    const aNum = parseInt(a.split('.')[0].split('-')[1]);
    const bNum = parseInt(b.split('.')[0].split('-')[1]);
    return aNum - bNum;
  });

  const allImagesPath = allImgs.map(img => path.resolve(chapterPath, img));
  const outputPath = path.resolve(
    `${chaptersPath}/pdf`,
    `${transformInvalidPathChar(metaData.title)}.pdf`
  );

  if (shouldChapterSkipToPdf?.(chapter)) {
    Logger.log(` !!!!!!!!!! ${chapter} 跳过转换 !!!!!!!!!! `, {
      imgsPath: allImagesPath,
      outputPath,
    });
    return;
  }
  if (fs.existsSync(outputPath)) {
    if (!shouldUpdatePdf?.(chapter)) {
      Logger.success(`${chapter} 已存在, 跳过转换: ${outputPath}`);
      return;
    }
    Logger.log(`当前章节需要更新, 删除已有pdf: ${outputPath}`);
    fs.unlinkSync(outputPath);
  }
  await imgsToPdf({ imgsPath: allImagesPath, outputPath });
  Logger.success(`${chapter} 转换为 pdf 成功: ${outputPath}`);
};

interface IStartDownloadParams {
  /**
   * 是否并发下载所有章节
   */
  concurrentDldAllChapters: boolean;
  /**
   * 在下载某一章节时, 是否并发下载该章节的所有图片
   */
  concurrentDldImgsOfOneChapter: boolean;
  /**
   * 是否强制更新章节详情(用于在网站更新后, 重新下载所有章节url), 默认为 false
   */
  forceUpdateChapterDetail?: boolean;
}

const startDownload = async (
  params: IStartDownloadParams
): Promise<{ diff: IChapterWithDetail[] }> => {
  try {
    const {
      concurrentDldAllChapters = false,
      concurrentDldImgsOfOneChapter = false,
      forceUpdateChapterDetail = false,
    } = params;
    const { all: details, diff } = await fetchChapters(
      forceUpdateChapterDetail
    );
    const diffChapters = diff.map(chapter => chapter.chapterNum);

    const downloadFn = (detail: IChapterWithDetail) => {
      return download({
        detail,
        concurrent: concurrentDldImgsOfOneChapter,
        needUpdate: diffChapters.includes(detail.chapterNum),
      });
    };

    Logger.log('开始下载图片');
    if (concurrentDldAllChapters) {
      await Promise.all(details.map(detail => downloadFn(detail)));
    } else {
      for (const detail of details) {
        await downloadFn(detail);
      }
    }
    Logger.log('所有图片下载完成');
    return { diff };
  } catch (error) {
    Logger.error('发生错误', error);
    return { diff: [] };
  }
};

interface IStartParams extends IStartDownloadParams {
  /**
   * 是否并发转换所有章节为 pdf
   */
  concurrentChaptersToPdf: boolean;
  /**
   * 是否跳过转换当前章节为 pdf
   */
  shouldChapterSkipToPdf?: (chapter: string) => boolean;
}

const start = async (params: IStartParams) => {
  const { concurrentChaptersToPdf, shouldChapterSkipToPdf, ...rest } = params;
  const { diff } = await startDownload(rest);
  const diffChapters = diff.map(chapter => chapter.chapterNum);

  const chaptersPath = path.resolve(__dirname, '../results/chapters');
  let chapters = filterDSStore(fs.readdirSync(chaptersPath));
  // ['Chapter-1', 'Chapter-2', 'Chapter-3', 'Chapter-4', ...]
  chapters = chapters.filter(chapter => !chapter.includes('pdf'));
  chapters.sort((a, b) => {
    const aNum = parseInt(a.split('-')[1]);
    const bNum = parseInt(b.split('-')[1]);
    return aNum - bNum;
  });

  const toPdfFn = (chapter: string) => {
    return toPdf({
      chaptersPath,
      chapter,
      shouldChapterSkipToPdf,
      shouldUpdatePdf: () =>
        diffChapters.includes(parseInt(chapter.split('-')[1])),
    });
  };

  if (concurrentChaptersToPdf) {
    await Promise.all(chapters.map(chapter => toPdfFn(chapter)));
  } else {
    for (const chapter of chapters) {
      await toPdfFn(chapter);
    }
  }
  Logger.success('漫画已全部更新成功～ 🎉🎉🎉', true);
};

const params = getParamsFromCmdLine();
const forceUpdateChapterDetail = params['update'] === 'true';

start({
  concurrentDldAllChapters: false,
  concurrentDldImgsOfOneChapter: true,
  concurrentChaptersToPdf: false,
  forceUpdateChapterDetail,
});
