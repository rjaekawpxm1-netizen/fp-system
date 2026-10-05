// FTR/DET 규칙표 본체는 서버와 공유하는 fpDerivation.cjs에 있다.
import fpDerivation from './fpDerivation.cjs';

export const { deriveDET, deriveFTR, deriveFPRow, classifyByVerb, DET_RULES_DOC } = fpDerivation;
