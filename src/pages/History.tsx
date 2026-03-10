import { useState, useEffect } from 'react';
import { generateAPI } from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, Clock, Image as ImageIcon, Wand2, Images } from 'lucide-react';
import { toast } from 'sonner';

interface GeneratedImage {
  id: string;
  prompt: string;
  mode: 'text2img' | 'img2img' | 'multiImg';
  provider: string;
  model: string;
  size: string;
  aspectRatio: string;
  imageUrl: string | null;
  imageBase64: string | null;
  createdAt: string;
}

export default function History() {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await generateAPI.getHistory();
      setImages(response.data);
    } catch (error) {
      toast.error('加载历史记录失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = (imageUrl: string, id: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `generated-${id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('图片下载中...');
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'text2img':
        return <Wand2 className="w-3 h-3" />;
      case 'img2img':
        return <ImageIcon className="w-3 h-3" />;
      case 'multiImg':
        return <Images className="w-3 h-3" />;
      default:
        return <Wand2 className="w-3 h-3" />;
    }
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'text2img':
        return '文生图';
      case 'img2img':
        return '图生图';
      case 'multiImg':
        return '多图参考';
      default:
        return mode;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">生成历史</h1>
          <p className="text-muted-foreground mt-1">
            查看您之前生成的所有图像
          </p>
        </div>
        <Button variant="outline" onClick={loadHistory}>
          <Clock className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      {images.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-8 h-8 text-violet-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              暂无生成记录
            </h3>
            <p className="text-gray-500">
              去生成页面创建您的第一张AI图像吧
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((image) => (
            <Card key={image.id} className="overflow-hidden group">
              <div className="aspect-square bg-gray-100 relative overflow-hidden">
                {image.imageUrl || image.imageBase64 ? (
                  <img
                    src={image.imageUrl || image.imageBase64 || ''}
                    alt={image.prompt}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-gray-300" />
                  </div>
                )}
                <div className="absolute top-2 left-2 flex gap-1">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    {getModeIcon(image.mode)}
                    {getModeLabel(image.mode)}
                  </Badge>
                </div>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDownload(image.imageUrl || image.imageBase64 || '', image.id)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载
                  </Button>
                </div>
              </div>
              <CardContent className="p-4">
                <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                  {image.prompt}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{image.model}</span>
                  <span>{formatDate(image.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {image.size}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {image.aspectRatio}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
