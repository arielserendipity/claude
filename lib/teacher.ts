// 교사 미리보기: 첫 화면 이름 칸에 이 코드를 넣으면 답을 다 쓰지 않아도 모든 문항·단계로 넘어갈 수 있다.
// (학생이 우연히 쓰지 않을 정도의 간단한 코드이며 보안용 비밀번호는 아님)
const CODE: string = (((import.meta as any).env?.VITE_TEACHER_CODE as string) || 'math2026').trim().toLowerCase();

export const isTeacherName = (name: string) => name.trim().toLowerCase() === CODE;
