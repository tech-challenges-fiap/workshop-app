# language: pt

Funcionalidade: Fluxo feliz da saga distribuída da Ordem de Serviço (OS)
  Como Service de OS (workshop-app)
  Quero orquestrar a saga distribuída da Ordem de Serviço
  Para garantir que, no caminho feliz, orçamento aprovado e execução concluída
  levem a saga a COMPLETED com os eventos distribuídos corretos publicados na
  ordem certa

  Cenário: OS aberta, orçamento aprovado e execução concluída chegam a COMPLETED
    Dado uma OS aberta com diagnóstico concluído aguardando aprovação do orçamento
    Quando o orçamento é aprovado pelo serviço de billing
    E a execução é concluída pelo serviço de execução
    Então a saga da OS chega ao estado COMPLETED
    E os eventos a seguir foram publicados na ordem certa
      | os.work-order.billing-authorization-requested.v1 |
      | os.work-order.execution-requested.v1              |
