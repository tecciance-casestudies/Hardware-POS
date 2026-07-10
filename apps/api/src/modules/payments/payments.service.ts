import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import { Payment } from '@hardware-pos/database';

import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsRepository } from './payments.repository';

@Injectable()
export class PaymentsService {
  constructor(private readonly paymentsRepository: PaymentsRepository) {}

  listBySale(tenantId: string, saleId: string): Promise<Payment[]> {
    return this.paymentsRepository.findBySale(tenantId, saleId);
  }

  async getById(tenantId: string, id: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findByIdForTenant(tenantId, id);
    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found`);
    }
    return payment;
  }

  /**
   * Record a payment against a sale.
   * TODO: validate the sale, update its paid/balance amounts and payment status,
   * then enqueue a QuickBooks Payment sync for credit/invoice sales.
   */
  create(_tenantId: string, _dto: CreatePaymentDto): Promise<Payment> {
    throw new NotImplementedException('Payment creation is not implemented yet');
  }
}
