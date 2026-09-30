import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';

const app = express();
const port = 3000;

app.use(express.json());

// Server-side Google GenAI initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface DragLog {
  action: 'DRAG_BLOCK' | 'DRAG_FULCRUM';
  id?: string;
  startPos: number;
  endPos: number;
  durationMs: number;
}

interface AnalyzeRequestBody {
  playerName?: string;
  level: number;
  levelFailCount: number;
  isSuccess: boolean;
  explorationTimeSec: number;
  logs: DragLog[];
  blocks: { id: string; position: number; weight: number }[];
  fulcrumPosition: number;
  average: number;
}

// AI Analysis & Recommendation endpoint
app.post('/api/analyze', async (req, res) => {
  const {
    playerName = '학생',
    level = 1,
    levelFailCount = 0,
    isSuccess = false,
    explorationTimeSec = 0,
    logs = [],
    blocks = [],
    fulcrumPosition = 5.5,
    average = 5.5,
  }: AnalyzeRequestBody = req.body;

  const blockPositions = blocks.map((b) => b.position);
  const sumOfPositions = blockPositions.reduce((a, b) => a + b, 0);
  const countOfBlocks = blocks.length;

  let logText = logs
    .map((l) => {
      if (l.action === 'DRAG_BLOCK') {
        return `화물(${l.id}) 위치 ${l.startPos} => ${l.endPos} (${(l.durationMs / 1000).toFixed(1)}초 체공)`;
      }
      if (l.action === 'DRAG_FULCRUM') {
        return `부력 중심점 위치 ${l.startPos} => ${l.endPos} (${(l.durationMs / 1000).toFixed(1)}초 체공)`;
      }
      return '';
    })
    .filter(Boolean)
    .join(', ');

  if (!logText) {
    logText = '(초기 위치에서 중심점 이동 없이 확인 버튼 클릭)';
  }

  const prompt = `
당신은 초등학교 수학 교육용 게임 '이퀼리브리엄 호: 평균의 바다'의 AI 학습 진단 및 적응형 피드백 엔진입니다.

[상황 데이터]
- 학생 이름: ${playerName}
- 현재 게임 레벨: ${level}
- 이번 라운드 누적 실패(오답) 횟수: ${levelFailCount}회
- 이번 시도 성공 여부: ${isSuccess ? '성공 (균형 완벽 일치)' : '실패 (기울어짐)'}
- 탐구 및 조작 시간: ${explorationTimeSec}초
- 적재된 화물들의 위치 목록: [${blockPositions.join(', ')}] (총 ${countOfBlocks}개, 위치 합: ${sumOfPositions})
- 수학적 정확한 평균(목표 균형점): ${average}
- 학생이 지정한 부력 중심점(Fulcrum): ${fulcrumPosition} (오차: ${Math.abs(fulcrumPosition - average).toFixed(1)})
- 학생의 이번 턴 조작 과정: [${logText}]
- 게임 규칙: 화물은 배에 단단히 고정되어 있으며, 학생은 오직 '부력 중심점'만 좌우로 조작하여 전체 화물의 균형점(평균)을 맞춰야 합니다.

[핵심 요구사항]
1. 힌트 정책 (매우 중요):
   - 이번 라운드 누적 실패 횟수가 2회 이상 (${levelFailCount} >= 2)인 경우:
     * 반드시 학생이 평균의 원리(화물들의 위치 총합을 화물 개수로 나눔, 또는 화물들로부터 좌우 거리의 균형)를 깨달을 수 있는 구체적이고 친절한 힌트("hintForStudent")를 작성하세요.
     * "activateVisualHint"를 true로 설정하여 화면에 화물과 중심점 사이 거리 곡선 보조선이 켜지도록 하세요.
   - 이번 라운드 누적 실패 횟수가 1회인 경우 (${levelFailCount} < 2):
     * 정답을 바로 알려주지 말고, 한 번 더 침착하게 계산하거나 어느 쪽으로 기울었는지 생각해 보도록 가볍게 격려하세요.
     * "activateVisualHint"는 false로 설정하세요.
2. 성공 시:
   - 학생의 수학적 성취를 칭찬하고, 다음 레벨 난이도(화물 추가 수 blocksToAdd: 1~2개, 평균이 자연수일지 forceInteger: true/false)를 학생의 탐구 숙련도에 맞춰 결정하고 그 이유(reasoningForNextStep)를 설명하세요.
3. 교사용 분석 로그(teacherLog):
   - 학생이 걸린 시간, 중심점을 조작한 양상, 오차의 방향을 토대로 학생이 평균 개념에서 어떤 어려움이나 특징을 보이는지 교육학적으로 분석하여 요약하세요.
`;

  // Fallback builder
  const buildFallback = () => {
    const shouldActivateVisualHint = !isSuccess && levelFailCount >= 2;
    let hintMessage = '';
    if (isSuccess) {
      hintMessage = `훌륭해요, ${playerName} 선원! 완벽한 부력 중심점을 찾아 배가 평온을 되찾았습니다.`;
    } else if (levelFailCount >= 2) {
      hintMessage = `💡 [AI 특별 힌트] 모든 화물 위치의 합(${sumOfPositions})을 화물 개수(${countOfBlocks}개)로 나누면 정확한 중심점(${average})이 됩니다! 화면의 거리 보조선도 확인해보세요.`;
    } else {
      const diff = fulcrumPosition - average;
      const directionMsg = diff > 0 ? '너무 오른쪽(우현)에' : '너무 왼쪽(좌현)에';
      hintMessage = `배가 기울었습니다! 중심점이 ${directionMsg} 위치해 있네요. 한 번 더 신중하게 맞춰보세요! (2회 이상 오답 시 AI 힌트 제공)`;
    }

    return {
      teacherLog: `[학습 진단] ${playerName} 학생은 ${explorationTimeSec}초간 탐구 후 중심점을 ${fulcrumPosition}에 위치시킴(정답: ${average}). ${
        isSuccess ? '성공적으로 균형을 맞춤' : `${levelFailCount}회차 오답 탐색 중`
      }. 조작 로그: ${logText}`,
      reasoningForNextStep: isSuccess
        ? '현재 단계의 평균 계산 원리를 잘 이해하였으므로 다음 해역에 새로운 화물을 추가하여 점진적으로 도전 과제를 부여합니다.'
        : '동일 단계에서 화물 위치와 중심점 사이 거리 관계를 체득할 수 있도록 유도합니다.',
      hintForStudent: hintMessage,
      activateVisualHint: shouldActivateVisualHint,
      blocksToAdd: isSuccess ? (explorationTimeSec < 10 ? 2 : 1) : 1,
      forceInteger: true,
    };
  };

  if (process.env.GEMINI_API_KEY) {
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                teacherLog: {
                  type: Type.STRING,
                  description: '교사용 학생 탐구 패턴 및 개념 이해도 분석 (시간 및 조작 양상 반영)',
                },
                reasoningForNextStep: {
                  type: Type.STRING,
                  description: '다음 단계 난이도(화물 수, 정수 여부)를 결정한 AI의 논리적 이유',
                },
                hintForStudent: {
                  type: Type.STRING,
                  description: '학생에게 안내할 따뜻하고 이해하기 쉬운 1~2줄 힌트/칭찬 메시지',
                },
                activateVisualHint: {
                  type: Type.BOOLEAN,
                  description: '2회 이상 실패 시 거리 시각화 보조선을 켤지 여부',
                },
                blocksToAdd: {
                  type: Type.INTEGER,
                  description: '성공 시 다음 레벨에 추가할 화물 수 (1 또는 2)',
                },
                forceInteger: {
                  type: Type.BOOLEAN,
                  description: '성공 시 다음 레벨 균형점이 정수여야 하는지 여부',
                },
              },
              required: [
                'teacherLog',
                'reasoningForNextStep',
                'hintForStudent',
                'activateVisualHint',
                'blocksToAdd',
                'forceInteger',
              ],
            },
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          if (!isSuccess && levelFailCount >= 2) {
            parsed.activateVisualHint = true;
          }
          return res.json(parsed);
        }
      } catch (err) {
        console.warn(`Model ${model} call failed, trying next:`, err);
      }
    }
  }

  // If models fail or key missing, return smart educational fallback
  return res.json(buildFallback());
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer();
