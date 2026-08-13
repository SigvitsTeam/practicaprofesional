import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { RequestWithContext } from '../../../common/http/request-context';
import { CurrentSubject } from '../../authorization/http/current-subject.decorator';
import { RequireAccess } from '../../authorization/http/require-access.decorator';
import {
  DataLevel,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { CreateAttentionUseCase } from '../application/create-attention.use-case';
import {
  CaptureConfigurationError,
  InvalidAttentionError,
  type CreatedAttention,
} from '../domain/its-attention';
import { CreateAttentionDto } from './create-attention.dto';

@Controller('its1/attentions')
export class ItsAttentionsController {
  constructor(private readonly createAttention: CreateAttentionUseCase) {}

  @Post()
  @RequireAccess({
    permission: 'its1:attentions:create',
    dataLevel: DataLevel.Individual,
    scope: 'OWN',
    target: (request) => ({ facilityId: (request.body as CreateAttentionDto).facilityId }),
  })
  async create(
    @Body() body: CreateAttentionDto,
    @CurrentSubject() subject: AuthorizationSubject,
    @Req() request: RequestWithContext,
  ): Promise<CreatedAttention> {
    try {
      return await this.createAttention.execute({
        ...body,
        attentionDate: new Date(`${body.attentionDate}T00:00:00.000Z`),
        userId: subject.userId,
        requestId: request.requestId,
        diagnoses: body.diagnoses,
      });
    } catch (error: unknown) {
      if (error instanceof InvalidAttentionError) throw new BadRequestException(error.message);
      if (error instanceof CaptureConfigurationError)
        throw new ServiceUnavailableException(error.message);
      throw error;
    }
  }
}
