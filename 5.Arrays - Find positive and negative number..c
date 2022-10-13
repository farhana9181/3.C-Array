//Find positive and negative number using array .
#include<stdio.h>
void main ()
{
    int num[50],i, n,pos=0, neg=0;
    printf("How many numbers you want to input = ");
    scanf("%d",&n);
    printf("Enter  %d  numbers  =\n",n);
    for(i=0; i<n; i++)
    {
        printf("num[%d] =",i);
        scanf("%d",&num[i]);
    }
    printf("All numbers are = \n");
    for(i=0; i<n; i++)
    {
        printf("%d\t",num[i]);
    }
    printf("\nPositive numbers are = \n");
       for(i=0; i<n; i++)
       {
           if(num[i] >=0)
           {
                 printf("%d\t", num[i]);
               pos++;
           }

       }
       printf("\n-----There are %d Positive numbers.-----\n",pos);

       printf("\nnegetive numbers are = \n");
       for(i=0; i<n; i++)
       {
           if(num[i] <0)
           {
               printf("%d\t", num[i]);
               neg++;
           }
       }
    printf("\n------There are %d Negetive numbers .------\n",neg);
    getch();
}
