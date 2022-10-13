//transpose marix
#include<stdio.h>
void main (){
int a[5][5], trans[5][5],n,i,m,j;
printf(" How many row =");
scanf("%d",&n);
printf(" How many column =");
scanf("%d",&m);
printf("------Enter elements  matrix------- \n");
for(i=0; i<n; i++)
{
    for(j=0 ; j< m ; j++)
    {
        printf("a[%d][%d] = ",i,j);
        scanf("%d",&a[i][j]);
    }
}
printf("------Matrix  are ------- \n");
for(i=0; i<n; i++)
{
    for(j=0 ; j< m ; j++)
    {
        printf("%d\t",a[i][j]);
    }
    printf("\n");
}
printf("------Transpose matrix------- \n");
for(i=0; i<n; i++)
{
    for(j=0 ; j< m ; j++)
    {
  trans[j][i]=  a[i][j] ;
    }
}
for(i=0; i<m; i++) //change col
{
    for(j=0 ; j< n ; j++)//change row
    {
    printf("%d\t",trans[i][j]);
    }
    printf("\n");
}
}
