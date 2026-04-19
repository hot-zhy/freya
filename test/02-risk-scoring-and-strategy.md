# MR 风险评分与测试策略设计

## 1. 目标

当 MR 提交后，系统自动输出：

- 风险分数（0-100）和风险等级（L1-L4）
- 风险结论的可解释证据
- 对应测试策略与灰度观察建议

## 2. 风险特征体系

## 2.1 代码变更特征（Change）

- 变更规模：变更行数、文件数、模块数
- 变更类型：功能新增、重构、配置、依赖升级、数据迁移
- 敏感路径触达：鉴权、支付、订单、消息队列、缓存一致性
- 测试变更信号：是否补充关键测试、覆盖率是否下降

## 2.2 依赖影响特征（Dependency）

- 跨服务影响面：上游/下游受影响服务数量
- 契约变更：OpenAPI/Proto 是否存在 breaking change
- 数据面影响：DB schema 变化、迁移脚本、索引调整
- 外部依赖风险：第三方 SDK 版本变更、超时重试策略变化

## 2.3 服务关键度特征（Criticality）

- 服务等级（S0/S1/S2）
- 历史可用性与事故严重度
- 业务峰值相关性（活动期/核心交易链路）

## 2.4 历史问题特征（History）

- 相似历史拦截案例数量（近 90/180 天）
- 相同问题类型复现概率（如幂等、并发竞态、金额精度）
- 团队/模块历史拦截密度

## 2.5 发布上下文特征（ReleaseContext）

- 发布窗口（封网、节假日、活动日）
- 环境一致性（staging 验证充分性）
- 灰度能力（是否支持分批、是否具备快速回滚）

## 3. 风险评分模型

## 3.1 分项得分

将每类特征标准化到 [0,1]：

- `C`: Change
- `D`: Dependency
- `K`: Criticality
- `H`: History
- `R`: ReleaseContext

## 3.2 综合评分公式

`score_raw = wC*C + wD*D + wK*K + wH*H + wR*R + coupling_bonus`

- `coupling_bonus` 用于放大组合风险（例如“高关键度 + 大依赖面”）
- `score = round(100 * sigmoid(score_raw - bias))`

建议初始权重（可后续迭代）：

- `wC=0.22`
- `wD=0.24`
- `wK=0.20`
- `wH=0.20`
- `wR=0.14`

## 3.3 分级规则（L1-L4）

- **L1（低风险）**：`score < 35` 且无高风险触发器
- **L2（中低风险）**：`35 <= score < 55`
- **L3（中高风险）**：`55 <= score < 75` 或命中中高触发器
- **L4（高风险）**：`score >= 75` 或命中高风险硬规则

高风险硬规则示例：

- 支付链路 + DB schema 变更
- breaking 契约 + 多下游依赖
- 活动窗口 + 核心服务高影响变更

## 3.4 评分伪代码

```text
function assessMR(mr):
  features = extractFeatures(mr)
  C = calcChangeScore(features.change)
  D = calcDependencyScore(features.dependency)
  K = calcCriticalityScore(features.criticality)
  H = calcHistoryScore(features.history)
  R = calcReleaseScore(features.releaseContext)

  hardRules = evaluateHardRules(features)
  if hardRules.hit:
      return buildResult(level="L4", score=100, reasons=hardRules.evidence)

  bonus = calcCouplingBonus(C, D, K, H, R)
  raw = wC*C + wD*D + wK*K + wH*H + wR*R + bonus
  score = round(100 * sigmoid(raw - bias))
  level = mapToLevel(score, features.triggers)

  testPlan = recommendTestStrategy(level, features)
  evidence = collectTopEvidence(features, topK=5)
  return buildResult(level, score, evidence, testPlan)
```

## 4. 可解释输出模板

每次评估必须输出：

- `risk_level`：L1-L4
- `risk_score`：0-100
- `top_risk_drivers`：前 3-5 个驱动因素
- `evidence`：文件路径、规则 ID、历史案例 ID
- `recommended_test_plan`：按测试类型分组
- `residual_risk`：残余风险和观察指标

## 5. 风险等级到测试策略映射

## 5.1 测试策略包定义

- `unit_tests`：边界条件、异常分支、金额/时区/并发关键逻辑
- `integration_tests`：服务契约、DB/缓存/消息链路验证
- `regression_tests`：核心业务旅程回归
- `performance_tests`：容量、延迟、资源利用率验证
- `resilience_tests`：超时、熔断、降级、回滚演练
- `canary_observations`：灰度比例、KPI/SLO 观察项、回滚阈值

## 5.2 映射矩阵

| 风险等级 | 单测 | 集成测试 | 回归测试 | 性能测试 | 容灾测试 | 灰度观察 |
|---|---|---|---|---|---|---|
| L1 | 必选 | 可选 | 可选 | 否 | 否 | 常规监控 |
| L2 | 必选 | 必选（关键链路） | 冒烟+核心路径 | 触发式 | 可选 | 增强监控 |
| L3 | 必选 | 必选（跨服务） | 必选（核心集合） | 建议执行 | 触发式 | 分阶段灰度 + SLO 门禁 |
| L4 | 必选 | 必选（全链路） | 必选（扩大范围） | 必选 | 必选 | 小流量灰度 + 对账/资损监控 + 回滚预案 |

## 6. 在线学习与持续优化

- 每次 MR 上线后采集结果标签：误报、漏报、真实事故、回滚
- 每周对权重和阈值进行校准（按服务等级或业务线分桶）
- 每月更新规则库：新增高频缺陷模式、淘汰无效规则
- 用历史拦截记录构建检索知识库，增强解释和建议置信度

## 7. 门禁策略建议

- 初期：只给建议，不阻塞合并（软门禁）
- 中期：L4 强提醒 + 需人工确认
- 成熟期：关键系统 L4 触发强制门禁，L3 条件门禁

通过“建议与强制分层”降低组织阻力，同时保障关键路径质量。
