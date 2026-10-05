// FTR/DET 규칙표 본체는 서버와 공유하는 shared/fpDerivation에 있다.
import fpDerivation from './shared/fpDerivation';

export const { deriveDET, deriveFTR, deriveFPRow, classifyByVerb, DET_RULES_DOC } = fpDerivation;
