export type Scalar = number | string | boolean;
export type Value = Scalar | Value[];
export type Variables = Record<string, Value>;
export type InputKind = 'number' | 'text' | 'array' | 'matrix';
export interface InputSpec {
  kind: InputKind; integer: boolean; min: number; max: number;
  minLength: number; maxLength: number; elementKind: 'number' | 'text';
  rows: number; columns: number;
}
export interface Settings { indexBase: 0 | 1; inputs: Record<string, InputSpec> }
export interface Draft { version: 1; title: string; source: string; settings: Settings; builder?: BuilderDocument }
export type BuilderNode = { id: string; comment: string } & (
  { kind: 'assign'; assignments: Assignment[] } | { kind: 'print'; args: Expr[] } | { kind: 'input'; name: string } |
  { kind: 'if'; condition: Expr; body: BuilderNode[]; otherwise?: BuilderNode } |
  { kind: 'else'; body: BuilderNode[] } |
  { kind: 'for'; name: string; start: Expr; end: Expr; step: Expr; direction: 1 | -1; body: BuilderNode[] } |
  { kind: 'while'; condition: Expr; body: BuilderNode[] } |
  { kind: 'define'; name: string; parameters: string[]; body: BuilderNode[] } |
  { kind: 'return'; expression?: Expr } | { kind: 'call'; expression: Expr } |
  { kind: 'comment'; text: string } | { kind: 'blank' }
);
export interface BuilderDocument { version: 1; nodes: BuilderNode[] }
export interface SourceLine { line: number; depth: number; code: string; comment: string; column: number; original: string }
interface Position { column: number }
export type Expr = Position & (
  { kind: 'literal'; value: Scalar } |
  { kind: 'variable'; name: string } |
  { kind: 'array'; items: Expr[] } |
  { kind: 'index'; target: Expr; indices: Expr[] } |
  { kind: 'unary'; operator: string; expression: Expr } |
  { kind: 'binary'; operator: string; left: Expr; right: Expr } |
  { kind: 'call'; name: string; args: Expr[] }
);
export interface Target { name: string; indices: Expr[] }
export interface Assignment { target: Target; expression: Expr }
interface NodeBase { line: number; depth: number }
export type AssignNode = NodeBase & { kind: 'assign'; assignments: Assignment[] };
export type PrintNode = NodeBase & { kind: 'print'; args: Expr[] };
export type InputNode = NodeBase & { kind: 'input'; name: string };
export type IfNode = NodeBase & { kind: 'if'; condition: Expr; body: Node[]; otherwise?: IfNode | ElseNode };
export type ElseNode = NodeBase & { kind: 'else'; body: Node[] };
export type ForNode = NodeBase & { kind: 'for'; name: string; start: Expr; end: Expr; step: Expr; direction: 1 | -1; body: Node[] };
export type WhileNode = NodeBase & { kind: 'while'; condition: Expr; body: Node[] };
export type DefineNode = NodeBase & { kind: 'define'; name: string; parameters: string[]; body: Node[] };
export type ReturnNode = NodeBase & { kind: 'return'; expression?: Expr };
export type CallNode = NodeBase & { kind: 'call'; expression: Expr };
export type Node = AssignNode | PrintNode | InputNode | IfNode | ElseNode | ForNode | WhileNode | DefineNode | ReturnNode | CallNode;
export interface Editable { key: string; line: number; label: string; value: Value; assignment?: number; part?: 'start' | 'end' | 'step' }
export interface Parsed { nodes: Node[]; lines: SourceLine[]; variableNames: string[]; inputNames: string[]; editable: Editable[] }
export type Instruction = Node & { next: number | null; bodyEntry: number | null; falseEntry: number | null; bodyLines: number[] };
export interface Compiled extends Parsed { instructions: Instruction[]; entry: number | null; functions: Record<string, { parameters: string[]; entry: number | null }> }
export interface Read { name: string; indices: number[] }
export interface Change { name: string; indices: number[]; before?: Value; after: Value }
export interface TraceAssignment extends Read { sources: Read[] }
export interface TraceEvent {
  title: string; explanation: string; condition?: { resolved: string; result: boolean };
  assignments?: TraceAssignment[]; sources?: Read[];
}
export interface Loop { end: number; increment: number; iteration: number }
export interface Evaluation { value: Value; resolved: string; sources: Read[] }
export interface Pending {
  cache: Record<string, Evaluation>; awaiting?: string; assignmentIndex: number;
  descriptions: string[]; assignments: TraceAssignment[]; reads: Read[]; changes: Change[];
}
export interface Frame {
  name: string | null; pc: number | null; variables: Variables; loops: Record<number, Loop>; pending?: Pending;
}
export interface State {
  pc: number | null; steps: number; currentLine: number | null; completed: boolean;
  variables: Variables; output: string[]; changes: Change[]; reads: Read[]; skippedLines: number[];
  event: TraceEvent | null; loops: Record<number, Loop>; randomState: number; frames: Frame[];
}
export interface Diagnostic { message: string; line: number; column: number }
export interface ViewState extends State { error?: Diagnostic }
export interface ProgramInfo { lines: SourceLine[]; variableNames: string[]; inputNames: string[]; editable: Editable[] }
export interface WorkerRequest {
  generation: number; action: 'prepare' | 'step' | 'previous' | 'reset'; draft?: Draft; input?: Value;
}
export interface WorkerResponse {
  generation: number; kind: 'ready' | 'state' | 'error'; state?: ViewState;
  info?: ProgramInfo; request?: { name: string; line: number; spec: InputSpec }; error?: Diagnostic;
  outputAppend?: string[];
  outputReset?: boolean; canGoBack?: boolean;
}
