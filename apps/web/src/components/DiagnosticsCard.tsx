import { client } from "../api/client.js";
import { Button, Notice, useLoad } from "./ui.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";

export function DiagnosticsCard() {
  const { data, error, reload } = useLoad(() => client.health(), []);
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>运行诊断与存储</CardTitle>
          <CardDescription>检查本地服务和数据库连接。</CardDescription>
        </div>
        <Button size="sm" variant="outline" disabled={!data && !error} onClick={reload}>重新检测</Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <dl className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <dt className="font-medium">本地服务</dt>
            <dd className="text-muted-foreground">{data ? `运行正常（${data.version}）` : error ? "检测失败" : "检测中"}</dd>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <dt className="font-medium">数据库</dt>
            <dd className="text-muted-foreground">{data ? "已连接" : error ? "连接状态未知" : "检测中"}</dd>
          </div>
        </dl>
        <Notice error={error} loading={false} />
        <p className="text-muted-foreground">完整备份包含题库、作答记录和附件。恢复会覆盖当前数据，并在本机保留恢复前的数据库恢复点。</p>
      </CardContent>
    </Card>
  );
}
