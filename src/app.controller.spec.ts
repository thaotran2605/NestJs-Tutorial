import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const mockAppService = {
      getHello: vi.fn().mockResolvedValue('Hello World from Conduit API!'),
      getHealth: vi.fn().mockResolvedValue({
        status: 'ok',
        message: 'API is healthy and operational',
        timestamp: '2026-11-09T00:00:00.000Z',
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: mockAppService,
        },
      ],
    }).compile();

    appController = moduleRef.get<AppController>(AppController);
    appService = moduleRef.get<AppService>(AppService);
  });

  describe('root', () => {
    it('should return localized hello message', async () => {
      const result = await appController.getHello('en');
      expect(result).toEqual({ message: 'Hello World from Conduit API!' });
      expect(appService.getHello).toHaveBeenCalledWith('en');
    });
  });

  describe('health', () => {
    it('should return health status', async () => {
      const result = await appController.getHealth('en');
      expect(result.status).toBe('ok');
      expect(appService.getHealth).toHaveBeenCalledWith('en');
    });
  });
});
