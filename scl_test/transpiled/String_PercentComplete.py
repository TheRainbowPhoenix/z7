import math

def String_PercentComplete(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   percent_complete: Int
    context['String.PercentComplete'] = CONCAT_STRING(IN1=INT_TO_STRING(context['percent_complete']), IN2='% complete')
    return
