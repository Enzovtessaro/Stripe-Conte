import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  delta?: string;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
  className?: string;
}

export function MetricCard({ 
  title, 
  value, 
  delta, 
  trend = 'neutral',
  description,
  className 
}: MetricCardProps) {
  return (
    <Card className={cn(
      'transition-all duration-300',
      'hover:shadow-md',
      className
    )}>
      <CardHeader className="pb-1 md:pb-2 px-3 md:px-6 pt-3 md:pt-6">
        <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
        <div className="text-xl md:text-3xl font-bold tracking-tight">{value}</div>
        
        {delta && (
          <div className="flex items-center gap-1 mt-1 md:mt-2">
            {trend === 'up' && <TrendingUp className="h-2.5 w-2.5 md:h-3 md:w-3 text-green-600" />}
            {trend === 'down' && <TrendingDown className="h-2.5 w-2.5 md:h-3 md:w-3 text-red-600" />}
            <p className={cn(
              "text-[10px] md:text-sm font-medium",
              trend === 'up' && 'text-green-600',
              trend === 'down' && 'text-red-600',
              trend === 'neutral' && 'text-muted-foreground'
            )}>
              {delta}
            </p>
          </div>
        )}
        
        {description && (
          <p className="text-[9px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

